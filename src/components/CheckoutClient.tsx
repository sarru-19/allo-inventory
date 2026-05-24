"use client";
// src/components/CheckoutClient.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ReservationResponse } from "@/types";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Package,
  Loader2,
  ArrowLeft,
  ShoppingBag,
} from "lucide-react";

interface Props {
  initialReservation: ReservationResponse;
}

type UIState = "pending" | "confirmed" | "released" | "expired" | "error";

export default function CheckoutClient({ initialReservation }: Props) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [uiState, setUiState] = useState<UIState>(() => {
    if (initialReservation.status === "CONFIRMED") return "confirmed";
    if (initialReservation.status === "RELEASED") return "released";
    if (new Date(initialReservation.expiresAt) <= new Date()) return "expired";
    return "pending";
  });

  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = Math.floor(
      (new Date(initialReservation.expiresAt).getTime() - Date.now()) / 1000
    );
    return Math.max(0, diff);
  });

  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (uiState !== "pending") return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setUiState("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [uiState]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const countdownUrgent = secondsLeft <= 60;

  const handleConfirm = useCallback(async () => {
    setActionLoading("confirm");
    setActionError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      const data = await res.json();

      if (res.ok) {
        setReservation(data);
        setUiState("confirmed");
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (res.status === 410) {
        setUiState(data.code === "RESERVATION_RELEASED" ? "released" : "expired");
        setActionError(data.error);
      } else {
        setActionError(data.error || "Confirmation failed. Please try again.");
      }
    } catch {
      setActionError("Network error. Please check your connection.");
    } finally {
      setActionLoading(null);
    }
  }, [reservation.id]);

  const handleCancel = useCallback(async () => {
    setActionLoading("cancel");
    setActionError(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setReservation(data);
        setUiState("released");
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setActionError(data.error || "Cancellation failed.");
      }
    } catch {
      setActionError("Network error. Please check your connection.");
    } finally {
      setActionLoading(null);
    }
  }, [reservation.id]);

  function formatPrice(price: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));
  }

  const totalPrice = Number(reservation.product.price) * reservation.quantity;

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      {/* Back link */}
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm font-dm-sans transition-colors mb-10"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </a>

      {/* Status banner */}
      {uiState === "confirmed" && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 mb-8 animate-slide-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-syne font-700 text-emerald-300 text-lg">
              Order confirmed!
            </p>
            <p className="text-emerald-300/60 text-sm font-dm-sans">
              Your purchase is complete. A confirmation email would be sent in a
              real checkout.
            </p>
          </div>
        </div>
      )}

      {(uiState === "released") && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-5 mb-8 animate-slide-in">
          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="font-syne font-700 text-red-300 text-lg">
              Reservation cancelled
            </p>
            <p className="text-red-300/60 text-sm font-dm-sans">
              The held stock has been released back to inventory.
            </p>
          </div>
        </div>
      )}

      {uiState === "expired" && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 mb-8 animate-slide-in">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-syne font-700 text-amber-300 text-lg">
              Reservation expired
            </p>
            <p className="text-amber-300/60 text-sm font-dm-sans">
              Your 10-minute hold has ended. Return to products to reserve again.
            </p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="card overflow-hidden">
        {/* Header with countdown */}
        <div className="bg-gradient-to-r from-white/4 to-transparent p-6 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    uiState === "pending"
                      ? "bg-[#e8ff47] animate-pulse"
                      : uiState === "confirmed"
                      ? "bg-emerald-400"
                      : "bg-red-400"
                  }`}
                />
                <span className="text-xs font-syne font-600 tracking-widest uppercase text-white/40">
                  Reservation
                </span>
              </div>
              <h2 className="font-syne font-700 text-2xl text-white">
                {uiState === "pending"
                  ? "Complete your checkout"
                  : uiState === "confirmed"
                  ? "Purchase complete"
                  : uiState === "expired"
                  ? "Hold expired"
                  : "Reservation cancelled"}
              </h2>
              <p className="text-white/35 text-xs font-dm-sans mt-1 font-mono">
                #{reservation.id}
              </p>
            </div>

            {/* Countdown clock */}
            {uiState === "pending" && (
              <div
                className={`flex flex-col items-center ${
                  countdownUrgent ? "countdown-urgent" : ""
                }`}
              >
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                    countdownUrgent
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-white/10 bg-white/5 text-white"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-syne font-700 text-2xl tabular-nums">
                    {formatCountdown(secondsLeft)}
                  </span>
                </div>
                <span className="text-white/30 text-xs font-dm-sans mt-1">
                  remaining
                </span>
              </div>
            )}

            {/* Status badge for non-pending states */}
            {uiState !== "pending" && (
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-syne font-700 tracking-wide uppercase ${
                  uiState === "confirmed"
                    ? "badge-confirmed"
                    : uiState === "expired"
                    ? "badge-low"
                    : "badge-released"
                }`}
              >
                {uiState}
              </span>
            )}
          </div>
        </div>

        {/* Product details */}
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
              {reservation.product.imageUrl ? (
                <img
                  src={reservation.product.imageUrl}
                  alt={reservation.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="w-8 h-8 text-white/20" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-syne font-700 text-xl text-white leading-tight mb-1">
                {reservation.product.name}
              </h3>
              <div className="flex items-center gap-1.5 text-white/40 text-sm font-dm-sans">
                <MapPin className="w-3.5 h-3.5" />
                {reservation.warehouse.name} · {reservation.warehouse.location}
              </div>
              <div className="mt-2">
                <span className="text-xs font-dm-sans text-white/30 font-mono">
                  SKU: {reservation.product.sku}
                </span>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="rounded-xl bg-white/3 border border-white/8 divide-y divide-white/6 mb-6">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm font-dm-sans text-white/50">Unit price</span>
              <span className="text-sm font-dm-sans text-white">
                {formatPrice(reservation.product.price)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm font-dm-sans text-white/50">Quantity</span>
              <span className="text-sm font-dm-sans text-white">
                {reservation.quantity}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm font-dm-sans text-white/50">Warehouse</span>
              <span className="text-sm font-dm-sans text-white">
                {reservation.warehouse.name}
              </span>
            </div>
            <div className="flex justify-between px-4 py-4">
              <span className="font-syne font-700 text-white/70">Total</span>
              <span className="font-syne font-700 text-xl text-[#e8ff47]">
                {formatPrice(String(totalPrice))}
              </span>
            </div>
          </div>

          {/* Reservation meta */}
          <div className="grid grid-cols-2 gap-3 mb-6 text-sm font-dm-sans">
            <div className="rounded-lg bg-white/3 border border-white/6 p-3">
              <p className="text-white/35 text-xs mb-1">Reserved at</p>
              <p className="text-white/70">
                {new Date(reservation.createdAt ?? "").toLocaleTimeString(
                  "en-IN",
                  { hour: "2-digit", minute: "2-digit" }
                )}
              </p>
            </div>
            <div className="rounded-lg bg-white/3 border border-white/6 p-3">
              <p className="text-white/35 text-xs mb-1">
                {uiState === "confirmed"
                  ? "Confirmed at"
                  : uiState === "released" || uiState === "expired"
                  ? "Released at"
                  : "Expires at"}
              </p>
              <p className="text-white/70">
                {uiState === "confirmed" && reservation.confirmedAt
                  ? new Date(reservation.confirmedAt).toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" }
                    )
                  : new Date(reservation.expiresAt).toLocaleTimeString(
                      "en-IN",
                      { hour: "2-digit", minute: "2-digit" }
                    )}
              </p>
            </div>
          </div>

          {/* Action error */}
          {actionError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-dm-sans text-red-300">{actionError}</p>
            </div>
          )}

          {/* Action buttons — only when pending */}
          {uiState === "pending" && (
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="flex-1 py-3.5 rounded-xl border border-white/12 text-white/60 hover:text-white hover:border-white/20 transition-all font-syne font-600 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                className="flex-2 px-8 py-3.5 rounded-xl bg-[#e8ff47] text-[#0a0a0a] font-syne font-700 text-sm hover:bg-[#c8e030] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === "confirm" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Confirm purchase
                  </>
                )}
              </button>
            </div>
          )}

          {/* CTA for terminal states */}
          {(uiState === "confirmed" ||
            uiState === "released" ||
            uiState === "expired") && (
            <a
              href="/"
              className="block w-full text-center py-3.5 rounded-xl border border-white/12 text-white/60 hover:text-white hover:border-white/20 transition-all font-syne font-600 text-sm"
            >
              ← Back to products
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
