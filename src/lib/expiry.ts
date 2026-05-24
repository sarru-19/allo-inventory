// src/lib/expiry.ts
/**
 * Release all PENDING reservations whose expiresAt has passed.
 * Returns the number of reservations released.
 *
 * This is called:
 *  1. By the Vercel Cron job at /api/cron/expire-reservations (every minute in prod)
 *  2. Lazily on GET /api/products so the listing always reflects current stock
 */

import { prisma } from "@/lib/prisma";

export async function expireStaleReservations(): Promise<number> {
  const now = new Date();

  // Find all stale pending reservations
  const stale = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (stale.length === 0) return 0;

  // For each stale reservation, release the hold in a transaction
  await prisma.$transaction(async (tx) => {
    for (const r of stale) {
      // Decrement reservedUnits on the stock level
      await tx.stockLevel.updateMany({
        where: { productId: r.productId, warehouseId: r.warehouseId },
        data: { reservedUnits: { decrement: r.quantity } },
      });
    }

    // Mark all as released in one query
    await tx.reservation.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: { status: "RELEASED", releasedAt: now },
    });
  });

  return stale.length;
}
