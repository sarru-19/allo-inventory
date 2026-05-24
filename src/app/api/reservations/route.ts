// src/app/api/reservations/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock, getIdempotencyRecord, setIdempotencyRecord } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";
import { ok, err, handleZodError, RESERVATION_TTL_MINUTES } from "@/lib/api-helpers";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Idempotency ──────────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await getIdempotencyRecord(`reserve:${idempotencyKey}`);
    if (existing) {
      return Response.json(existing.body, { status: existing.statusCode });
    }
  }

  // ── Parse & validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  let input;
  try {
    input = CreateReservationSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return handleZodError(e);
    throw e;
  }

  const { productId, warehouseId, quantity, customerRef } = input;

  // ── Acquire distributed lock ─────────────────────────────────────────────
  // This ensures that concurrent requests for the same product/warehouse
  // are serialised. Only one request proceeds past this point at a time.
  const lockToken = await acquireLock(productId, warehouseId);
  if (!lockToken) {
    return err(
      "Another reservation for this item is in progress. Please retry in a moment.",
      429,
      "LOCK_CONTENTION"
    );
  }

  let responseBody: unknown;
  let responseStatus: number = 500;

  try {
    // ── Check & decrement stock inside a serialisable transaction ────────────
    //
    // We use a Postgres transaction with SELECT FOR UPDATE to guarantee that
    // no other concurrent transaction reads the same stock row between our
    // check and our update. Combined with the Redis lock above, this gives us
    // two layers of protection:
    //
    //   Layer 1 (Redis lock)   — fast-path rejection; only one Node process
    //                            proceeds to the DB at a time per SKU/warehouse.
    //   Layer 2 (SELECT FOR UPDATE) — database-level guarantee; handles cases
    //                            where the Redis lock can't be used (e.g. Redis
    //                            is temporarily unavailable and the lock returns
    //                            null but we still process the request).
    //
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock the stock row at DB level
        const stockRows = await tx.$queryRaw<
          { id: string; total_units: number; reserved_units: number }[]
        >`
          SELECT id, total_units AS "total_units", reserved_units AS "reserved_units"
          FROM "StockLevel"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        if (stockRows.length === 0) {
          return { error: "Stock level not found for this product/warehouse", status: 404 };
        }

        const stock = stockRows[0];
        const available = stock.total_units - stock.reserved_units;

        if (available < quantity) {
          return {
            error: `Insufficient stock. Requested ${quantity}, available ${available}.`,
            status: 409,
            code: "INSUFFICIENT_STOCK",
          };
        }

        // Increment reservedUnits
        await tx.$executeRaw`
          UPDATE "StockLevel"
          SET "reservedUnits" = "reservedUnits" + ${quantity},
              "updatedAt" = NOW()
          WHERE id = ${stock.id}
        `;

        // Create the reservation
        const expiresAt = new Date(
          Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
        );

        const reservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt,
            customerRef: customerRef ?? null,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true, price: true, imageUrl: true },
            },
            warehouse: {
              select: { id: true, name: true, location: true },
            },
          },
        });

        return {
          reservation: {
            ...reservation,
            product: {
              ...reservation.product,
              price: reservation.product.price.toString(),
            },
          },
        };
      },
      {
        isolationLevel: "Serializable",
        timeout: 10_000,
      }
    );

    if ("error" in result) {
      responseStatus = result.status ?? 500;
      responseBody = { error: result.error, code: (result as { code?: string }).code };
    } else {
      responseStatus = 201;
      responseBody = result.reservation;
    }
  } finally {
    // Always release the lock, even if an exception was thrown
    await releaseLock(productId, warehouseId, lockToken);
  }

  // ── Store idempotency record ─────────────────────────────────────────────
  if (idempotencyKey) {
    await setIdempotencyRecord(`reserve:${idempotencyKey}`, {
      statusCode: responseStatus,
      body: responseBody,
    });
  }

  return Response.json(responseBody, { status: responseStatus });
}
