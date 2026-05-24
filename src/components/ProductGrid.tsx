"use client";
// src/components/ProductGrid.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductWithStock, StockLevelWithWarehouse } from "@/types";
import { Package, MapPin, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";

interface Props {
  products: ProductWithStock[];
}

export default function ProductGrid({ products }: Props) {
  const router = useRouter();
  const [reserving, setReserving] = useState<{
    product: ProductWithStock;
    stockLevel: StockLevelWithWarehouse;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal(product: ProductWithStock, sl: StockLevelWithWarehouse) {
    setReserving({ product, stockLevel: sl });
    setQuantity(1);
    setError(null);
  }

  function closeModal() {
    if (loading) return;
    setReserving(null);
    setError(null);
  }

  async function handleReserve() {
    if (!reserving) return;
    setLoading(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: reserving.product.id,
          warehouseId: reserving.stockLevel.warehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        router.push(`/checkout/${data.id}`);
      } else if (res.status === 409) {
        setError(
          data.error ||
            "Not enough stock available. Someone may have just reserved the last unit."
        );
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(price: string) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(price));
  }

  function stockBadge(sl: StockLevelWithWarehouse) {
    if (sl.availableUnits === 0) return { label: "Out of stock", cls: "badge-out" };
    if (sl.availableUnits <= 3) return { label: `${sl.availableUnits} left`, cls: "badge-low" };
    return { label: `${sl.availableUnits} available`, cls: "badge-available" };
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((product, i) => {
          const totalAvailable = product.stockLevels.reduce(
            (sum, sl) => sum + sl.availableUnits,
            0
          );

          return (
            <div
              key={product.id}
              className="card overflow-hidden hover:border-white/16 transition-all duration-300 group"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Product image */}
              <div className="relative h-52 bg-[#1a1a1a] overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-12 h-12 text-white/20" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-syne font-600 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white/70">
                    {product.sku}
                  </span>
                </div>
                {totalAvailable === 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white/60 font-syne font-700 text-lg tracking-wide">
                      SOLD OUT
                    </span>
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="font-syne font-700 text-lg leading-tight text-white">
                    {product.name}
                  </h2>
                  <span className="font-syne font-700 text-lg text-[#e8ff47] whitespace-nowrap">
                    {formatPrice(product.price)}
                  </span>
                </div>

                {product.description && (
                  <p className="text-white/45 text-sm font-dm-sans leading-relaxed mb-4 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Stock per warehouse */}
                <div className="space-y-2 mb-5">
                  {product.stockLevels.map((sl) => {
                    const badge = stockBadge(sl);
                    return (
                      <div
                        key={sl.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/4 border border-white/6"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                          <span className="text-sm font-dm-sans text-white/70">
                            {sl.warehouse.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-syne font-600 px-2 py-0.5 rounded-full ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {sl.availableUnits > 0 && (
                            <button
                              onClick={() => openModal(product, sl)}
                              className="text-xs font-syne font-600 text-[#e8ff47] hover:text-white transition-colors flex items-center gap-0.5 group/btn"
                            >
                              Reserve
                              <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reserve modal */}
      {reserving && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={closeModal}
        >
          <div
            className="card w-full max-w-md animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#e8ff47] animate-pulse" />
                <span className="text-xs font-syne font-600 text-[#e8ff47] tracking-widest uppercase">
                  Reserve Unit
                </span>
              </div>
              <h3 className="font-syne font-700 text-xl text-white">
                {reserving.product.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-white/50 text-sm font-dm-sans">
                <MapPin className="w-3.5 h-3.5" />
                {reserving.stockLevel.warehouse.name} ·{" "}
                {reserving.stockLevel.warehouse.location}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Qty selector */}
              <div>
                <label className="block text-sm font-dm-sans font-500 text-white/70 mb-2">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-lg border border-white/12 bg-white/5 text-white hover:bg-white/10 transition-colors font-syne font-700 text-lg flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="font-syne font-700 text-2xl text-white w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          reserving.stockLevel.availableUnits,
                          quantity + 1
                        )
                      )
                    }
                    className="w-9 h-9 rounded-lg border border-white/12 bg-white/5 text-white hover:bg-white/10 transition-colors font-syne font-700 text-lg flex items-center justify-center"
                  >
                    +
                  </button>
                  <span className="text-white/35 text-sm font-dm-sans">
                    of {reserving.stockLevel.availableUnits} available
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-xl bg-white/4 border border-white/8 p-4 space-y-2">
                <div className="flex justify-between text-sm font-dm-sans">
                  <span className="text-white/50">Unit price</span>
                  <span className="text-white">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    }).format(Number(reserving.product.price))}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-dm-sans">
                  <span className="text-white/50">Quantity</span>
                  <span className="text-white">× {quantity}</span>
                </div>
                <div className="border-t border-white/8 pt-2 flex justify-between font-syne font-700">
                  <span className="text-white/70">Total</span>
                  <span className="text-[#e8ff47] text-lg">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    }).format(Number(reserving.product.price) * quantity)}
                  </span>
                </div>
              </div>

              <div className="text-xs font-dm-sans text-white/35 flex items-start gap-2">
                <span className="mt-0.5">⏱</span>
                Stock will be held for 10 minutes. Released automatically if
                checkout isn't completed.
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-dm-sans text-red-300">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border border-white/12 text-white/60 hover:text-white hover:border-white/20 transition-all font-syne font-600 text-sm disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReserve}
                  disabled={loading || quantity < 1}
                  className="flex-1 py-3 rounded-xl bg-[#e8ff47] text-[#0a0a0a] font-syne font-700 text-sm hover:bg-[#c8e030] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reserving…
                    </>
                  ) : (
                    "Reserve now →"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
