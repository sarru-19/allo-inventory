// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET() {
  // Lazy expiry: clean up stale reservations before reading stock
  await expireStaleReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: {
          warehouse: true,
        },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  // Compute availableUnits = totalUnits - reservedUnits
  const result = products.map((p) => ({
    ...p,
    price: p.price.toString(),
    stockLevels: p.stockLevels.map((sl) => ({
      ...sl,
      availableUnits: Math.max(0, sl.totalUnits - sl.reservedUnits),
    })),
  }));

  return NextResponse.json(result);
}
