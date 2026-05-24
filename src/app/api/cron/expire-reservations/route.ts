// src/app/api/cron/expire-reservations/route.ts
// Called by Vercel Cron every minute in production.
// Secured by CRON_SECRET env var (Vercel injects authorization header automatically).

import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.NODE_ENV === "production" && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await expireStaleReservations();
  return NextResponse.json({ released, timestamp: new Date().toISOString() });
}
