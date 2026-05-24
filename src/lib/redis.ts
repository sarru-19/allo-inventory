// src/lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ──────────────────────────────────────────────────────────────────────────
// Distributed lock helpers
// We use a simple SET NX PX pattern (SET key value NX PX ttlMs).
// The lock value is a random token so only the holder can release it.
// ──────────────────────────────────────────────────────────────────────────

const LOCK_TTL_MS = 5_000; // 5 s — enough time to complete the DB transaction

function lockKey(productId: string, warehouseId: string) {
  return `lock:reservation:${productId}:${warehouseId}`;
}

/**
 * Attempt to acquire a lock. Returns the token on success, null on failure.
 */
export async function acquireLock(
  productId: string,
  warehouseId: string
): Promise<string | null> {
  const token = crypto.randomUUID();
  const key = lockKey(productId, warehouseId);
  // SET key token NX PX ttl  — returns "OK" if acquired, null if already held
  const result = await redis.set(key, token, {
    nx: true,
    px: LOCK_TTL_MS,
  });
  return result === "OK" ? token : null;
}

/**
 * Release a lock only if we are the holder (compare-and-delete via Lua script).
 */
export async function releaseLock(
  productId: string,
  warehouseId: string,
  token: string
): Promise<void> {
  const key = lockKey(productId, warehouseId);
  // Lua script: only delete if the stored value matches our token
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, [key], [token]);
}

// ──────────────────────────────────────────────────────────────────────────
// Idempotency helpers
// ──────────────────────────────────────────────────────────────────────────

const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

export interface IdempotencyEntry {
  statusCode: number;
  body: unknown;
}

export async function getIdempotencyRecord(
  key: string
): Promise<IdempotencyEntry | null> {
  const raw = await redis.get<IdempotencyEntry>(
    `idempotency:${key}`
  );
  return raw ?? null;
}

export async function setIdempotencyRecord(
  key: string,
  entry: IdempotencyEntry
): Promise<void> {
  await redis.set(`idempotency:${key}`, entry, {
    ex: IDEMPOTENCY_TTL_SECONDS,
  });
}
