// src/app/api/reservations/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    return Response.json({ error: "Reservation not found" }, { status: 404 });
  }

  return Response.json({
    ...reservation,
    product: {
      ...reservation.product,
      price: reservation.product.price.toString(),
    },
  });
}
