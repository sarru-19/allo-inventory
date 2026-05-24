// src/lib/api-helpers.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleZodError(e: ZodError) {
  const messages = e.errors.map((x) => `${x.path.join(".")}: ${x.message}`);
  return err(messages.join("; "), 422, "VALIDATION_ERROR");
}

export const RESERVATION_TTL_MINUTES = 10;
