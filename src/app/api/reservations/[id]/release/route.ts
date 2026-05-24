// src/app/api/reservations/[id]/release/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation) {
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    // Idempotent: already released or confirmed — return current state
    return Response.json(reservation, { status: 200 });
  }

  const now = new Date();

  const released = await prisma.$transaction(async (tx) => {
    await tx.stockLevel.updateMany({
      where: {
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
      },
      data: { reservedUnits: { decrement: reservation.quantity } },
    });

    return tx.reservation.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: now },
    });
  });

  return Response.json(released, { status: 200 });
}
