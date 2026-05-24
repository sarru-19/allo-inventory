# Allo — Inventory & Reservation Platform

A Next.js application for multi-warehouse inventory management with race-condition-safe reservations during checkout.

**Live demo:** _[your-deployment.vercel.app]_  
**Repo:** _[github.com/you/allo-inventory]_

---

## What's built

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/products` | List products with available stock per warehouse |
| `GET` | `/api/warehouses` | List warehouses |
| `POST` | `/api/reservations` | Reserve units — returns 409 if insufficient stock |
| `GET` | `/api/reservations/:id` | Fetch a single reservation |
| `POST` | `/api/reservations/:id/confirm` | Confirm (payment success) — returns 410 if expired |
| `POST` | `/api/reservations/:id/release` | Release early (payment failed / user cancelled) |
| `GET` | `/api/cron/expire-reservations` | Called by Vercel Cron to sweep stale reservations |

---

## Running locally

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Neon free tier recommended)
- An Upstash Redis instance (free tier)

### 1. Clone & install

```bash
git clone https://github.com/you/allo-inventory
cd allo-inventory
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Neon Postgres — use the "Prisma" connection string from the Neon dashboard
DATABASE_URL="postgresql://user:pw@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pw@host/db?sslmode=require"

# Upstash Redis — REST URL and token from the Upstash console
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxx..."

NEXT_PUBLIC_BASE_URL="http://localhost:3000"
CRON_SECRET="any-random-string"
```

### 3. Database setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to your database (creates tables)
npm run db:push

# Seed with demo data
npm run db:seed
```

### 4. Start dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment (Vercel + Neon + Upstash)

1. **Neon** — create a project at [neon.tech](https://neon.tech). Copy the "Prisma" connection string for `DATABASE_URL` and the direct URL for `DIRECT_URL`.

2. **Upstash** — create a Redis database at [upstash.com](https://upstash.com). Copy the REST URL and token.

3. **Vercel** — import the repo and set all env vars in the project settings. Add `NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app`.

4. After deploy, run migrations:
   ```bash
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   ```

5. Vercel Cron is configured in `vercel.json` — it runs `/api/cron/expire-reservations` every minute automatically on Pro plans. The cron endpoint is protected by `CRON_SECRET` which Vercel injects as the `Authorization: Bearer` header.

---

## How the concurrency guarantee works

The reservation endpoint needs to be correct when two requests arrive simultaneously for the last unit of a SKU. We use **two complementary layers**:

### Layer 1 — Redis distributed lock (fast path)

When a reservation request arrives, we attempt to set a Redis key with `SET key token NX PX 5000` (SET if Not eXists, expiring in 5 s). Only one request can hold the lock per `(productId, warehouseId)` pair at a time. The second concurrent request gets a `429 Lock Contention` response immediately, without touching the database.

The lock token is a random UUID so only the holder can release it (compare-and-delete via a Lua script), preventing accidental release by other processes.

### Layer 2 — Postgres `SELECT FOR UPDATE` + Serializable transaction (safety net)

Inside the locked section, we run a Postgres transaction at `SERIALIZABLE` isolation level. The first thing we do is `SELECT ... FOR UPDATE` on the `StockLevel` row, which places an exclusive row lock at the database level. Any concurrent transaction that slips through (e.g. if Redis is momentarily unavailable) will block on this row lock until the first transaction commits, then re-read the stock and discover there are 0 units available.

This means:
- In normal operation: Redis lock prevents DB contention entirely.
- If Redis fails: Postgres serialisability catches the race.
- The two layers together mean **exactly one of two simultaneous requests for the last unit will succeed**.

### Why not just a DB transaction?

A DB transaction alone would work, but `SELECT FOR UPDATE` creates contention at the database level. Every concurrent checkout for any product/warehouse hits the DB and competes for row locks. The Redis lock layer means only one request per SKU/warehouse even reaches the DB, keeping the DB under control at scale.

---

## How the expiry mechanism works

Reservations have an `expiresAt` timestamp set 10 minutes in the future. We release stale reservations through **two complementary mechanisms**:

### 1. Vercel Cron (primary, production)

`vercel.json` configures a cron job that calls `GET /api/cron/expire-reservations` every minute. The handler calls `expireStaleReservations()`, which:
1. Queries all `PENDING` reservations where `expiresAt <= NOW()`
2. Decrements `reservedUnits` on the corresponding `StockLevel` rows
3. Marks all found reservations as `RELEASED` in a single transaction

The job runs server-side on Vercel's infra, so it works without a dedicated background worker.

### 2. Lazy cleanup on read (secondary)

`GET /api/products` also calls `expireStaleReservations()` before querying stock. This means the product listing always reflects current availability even if the cron job hasn't fired yet (e.g. in development where cron doesn't run).

The cron job and lazy cleanup are both idempotent — running them simultaneously is safe because the `WHERE status = 'PENDING' AND expiresAt <= NOW()` predicate selects the same rows, and the `updateMany` is idempotent once rows are marked `RELEASED`.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` both support the `Idempotency-Key` header.

**Implementation:**

1. Client generates a UUID and sends it as `Idempotency-Key: <uuid>` with every request.
2. On arrival, we check `redis.get("idempotency:<key>")`.
3. If a record exists, we immediately return the stored `{ statusCode, body }` — no side effects.
4. If not, we process normally and, after getting a result (success or handled error), store it in Redis with a 24-hour TTL.

This means a client can safely retry any request after a network timeout without fear of double-charging or double-reserving. The frontend generates a fresh key per user intent (not per HTTP attempt), so a retry of the _same_ checkout attempt replays the same result.

---

## Data model

```
Product          → has many StockLevel, Reservation
Warehouse        → has many StockLevel, Reservation
StockLevel       → (productId, warehouseId) unique
                   totalUnits, reservedUnits (counter)
                   availableUnits = totalUnits - reservedUnits
Reservation      → status: PENDING | CONFIRMED | RELEASED
                   expiresAt (10 min from creation)
IdempotencyRecord → key (Redis, not DB — for speed)
```

`reservedUnits` is a counter on `StockLevel` rather than a derived `COUNT(reservations)`. This avoids a potentially expensive aggregate query on the hot reservation path — we just read and compare two integers. The counter is incremented atomically inside the same transaction that creates the reservation, and decremented on confirm/release.

---

## Trade-offs & what I'd do with more time

### Made

- **Redis lock TTL of 5s** — tight enough that a failed process releases quickly; long enough for a Postgres round-trip. Could tune based on observed p99 query times.
- **`reservedUnits` counter on `StockLevel`** — faster reads, but requires careful increment/decrement bookkeeping. An alternative is `COUNT` with an index on `(productId, warehouseId, status)`.
- **Lazy expiry on product list** — simple but runs synchronously on each page load. Fine at low traffic; at scale I'd move it to background only.
- **No auth/session** — reservations are identified only by UUID. A production system would tie reservations to a user session/JWT.

### With more time

- **WebSocket / SSE for real-time stock updates** — currently the product listing is a server component that fetches on load. With Supabase Realtime or SSE, stock changes would push to connected clients.
- **Reservation ownership validation** — confirm/release should verify that the caller owns the reservation (session ID check).
- **Distributed tracing** — add OpenTelemetry spans around the lock/transaction to measure lock contention rates.
- **Retry queue** — instead of returning 429 on lock contention, enqueue the request and retry after a short backoff.
- **Multi-quantity reservation splitting** — allow reserving across warehouses if one warehouse doesn't have enough stock.
- **Admin dashboard** — view live reservation counts, stock levels, and expiry timelines.
