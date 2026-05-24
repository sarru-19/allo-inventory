// src/app/api/reservations/[id]/confirm/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotencyRecord, setIdempotencyRecord } from "@/lib/redis";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Idempotency ──────────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await getIdempotencyRecord(`confirm:${idempotencyKey}`);
    if (existing) {
      return Response.json(existing.body, { status: existing.statusCode });
    }
  }

  const now = new Date();

  // Find the reservation
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: {
        select: { id: true, name: true, sku: true, price: true, imageUrl: true },
      },
      warehouse: {
        select: { id: true, name: true, location: true },
      },
    },
  });

  if (!reservation) {
    return err("Reservation not found", 404, "NOT_FOUND");
  }

  if (reservation.status === "CONFIRMED") {
    // Already confirmed — idempotent success
    const body = {
      ...reservation,
      product: {
        ...reservation.product,
        price: reservation.product.price.toString(),
      },
    };
    return Response.json(body, { status: 200 });
  }

  if (reservation.status === "RELEASED") {
    return err(
      "This reservation has already been released and cannot be confirmed.",
      410,
      "RESERVATION_RELEASED"
    );
  }

  // Check expiry
  if (reservation.expiresAt <= now) {
    // Release the hold and mark as released
    await prisma.$transaction(async (tx) => {
      await tx.stockLevel.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      });
      await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: now },
      });
    });

    const responseBody = {
      error: "Reservation has expired. Please start a new checkout.",
      code: "RESERVATION_EXPIRED",
    };

    if (idempotencyKey) {
      await setIdempotencyRecord(`confirm:${idempotencyKey}`, {
        statusCode: 410,
        body: responseBody,
      });
    }

    return Response.json(responseBody, { status: 410 });
  }

  // Confirm the reservation — permanently decrement stock
  const confirmed = await prisma.$transaction(async (tx) => {
    // Decrement reservedUnits (the unit is now "sold")
    await tx.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
      },
      data: {
        reservedUnits: { decrement: reservation.quantity },
        totalUnits: { decrement: reservation.quantity },
      },
    });

    return tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: now },
      include: {
        product: {
          select: { id: true, name: true, sku: true, price: true, imageUrl: true },
        },
        warehouse: {
          select: { id: true, name: true, location: true },
        },
      },
    });
  });

  const responseBody = {
    ...confirmed,
    product: {
      ...confirmed.product,
      price: confirmed.product.price.toString(),
    },
  };

  if (idempotencyKey) {
    await setIdempotencyRecord(`confirm:${idempotencyKey}`, {
      statusCode: 200,
      body: responseBody,
    });
  }

  return Response.json(responseBody, { status: 200 });
}
