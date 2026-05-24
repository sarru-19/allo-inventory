// src/app/warehouses/page.tsx
import { prisma } from "@/lib/prisma";
import { MapPin, Package, BarChart3 } from "lucide-react";

async function getWarehousesWithStock() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    include: {
      stockLevels: {
        include: { product: true },
        orderBy: { product: { name: "asc" } },
      },
    },
  });

  return warehouses.map((wh) => ({
    ...wh,
    totalProducts: wh.stockLevels.length,
    totalUnits: wh.stockLevels.reduce((s, sl) => s + sl.totalUnits, 0),
    availableUnits: wh.stockLevels.reduce(
      (s, sl) => s + Math.max(0, sl.totalUnits - sl.reservedUnits),
      0
    ),
    reservedUnits: wh.stockLevels.reduce((s, sl) => s + sl.reservedUnits, 0),
    stockLevels: wh.stockLevels.map((sl) => ({
      ...sl,
      availableUnits: Math.max(0, sl.totalUnits - sl.reservedUnits),
      product: {
        ...sl.product,
        price: sl.product.price.toString(),
      },
    })),
  }));
}

export default async function WarehousesPage() {
  const warehouses = await getWarehousesWithStock();

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px w-8 bg-[#e8ff47]" />
          <span className="text-[#e8ff47] text-xs font-syne font-600 tracking-widest uppercase">
            Warehouse Network
          </span>
        </div>
        <h1 className="font-syne font-800 text-5xl md:text-6xl leading-[1.05] tracking-tight text-white mb-4">
          Stock by
          <br />
          <span className="text-[#e8ff47]">location.</span>
        </h1>
        <p className="text-white/50 font-dm-sans text-lg max-w-xl leading-relaxed">
          Live inventory levels across all fulfilment centres. Reserved units
          are held against active checkouts.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {warehouses.map((wh) => (
          <div key={wh.id} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-syne font-700 text-lg text-white leading-tight">
                  {wh.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-1 text-white/40 text-sm font-dm-sans">
                  <MapPin className="w-3.5 h-3.5" />
                  {wh.location}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#e8ff47]/10 border border-[#e8ff47]/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-[#e8ff47]" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/4 border border-white/6 py-2.5 px-1">
                <p className="font-syne font-700 text-xl text-white">
                  {wh.totalUnits}
                </p>
                <p className="text-white/35 text-xs font-dm-sans mt-0.5">Total</p>
              </div>
              <div className="rounded-lg bg-[#e8ff47]/6 border border-[#e8ff47]/15 py-2.5 px-1">
                <p className="font-syne font-700 text-xl text-[#e8ff47]">
                  {wh.availableUnits}
                </p>
                <p className="text-[#e8ff47]/50 text-xs font-dm-sans mt-0.5">Available</p>
              </div>
              <div className="rounded-lg bg-amber-500/6 border border-amber-500/15 py-2.5 px-1">
                <p className="font-syne font-700 text-xl text-amber-400">
                  {wh.reservedUnits}
                </p>
                <p className="text-amber-400/50 text-xs font-dm-sans mt-0.5">Reserved</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-warehouse stock tables */}
      <div className="space-y-6">
        {warehouses.map((wh) => (
          <div key={wh.id} className="card overflow-hidden">
            {/* Table header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-white/2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#e8ff47]" />
                <h3 className="font-syne font-700 text-white">{wh.name}</h3>
                <span className="text-white/30 text-sm font-dm-sans">
                  {wh.location}
                </span>
              </div>
              <span className="text-xs font-syne font-600 text-white/30 tracking-wide uppercase">
                {wh.totalProducts} SKUs
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-dm-sans">
                <thead>
                  <tr className="border-b border-white/6">
                    <th className="text-left px-6 py-3 text-white/35 font-500 text-xs uppercase tracking-wide">
                      Product
                    </th>
                    <th className="text-left px-4 py-3 text-white/35 font-500 text-xs uppercase tracking-wide">
                      SKU
                    </th>
                    <th className="text-right px-4 py-3 text-white/35 font-500 text-xs uppercase tracking-wide">
                      Total
                    </th>
                    <th className="text-right px-4 py-3 text-white/35 font-500 text-xs uppercase tracking-wide">
                      Reserved
                    </th>
                    <th className="text-right px-6 py-3 text-white/35 font-500 text-xs uppercase tracking-wide">
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {wh.stockLevels.map((sl) => {
                    const pct =
                      sl.totalUnits > 0
                        ? Math.round((sl.availableUnits / sl.totalUnits) * 100)
                        : 0;
                    const statusColor =
                      sl.availableUnits === 0
                        ? "text-red-400"
                        : sl.availableUnits <= 3
                        ? "text-amber-400"
                        : "text-[#e8ff47]";

                    return (
                      <tr
                        key={sl.id}
                        className="hover:bg-white/2 transition-colors"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {sl.product.imageUrl ? (
                                <img
                                  src={sl.product.imageUrl}
                                  alt={sl.product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-white/20" />
                              )}
                            </div>
                            <span className="text-white/80 font-500">
                              {sl.product.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs text-white/35 bg-white/4 px-2 py-1 rounded">
                            {sl.product.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-white/50">
                          {sl.totalUnits}
                        </td>
                        <td className="px-4 py-3.5 text-right text-amber-400/70">
                          {sl.reservedUnits > 0 ? sl.reservedUnits : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {/* Mini progress bar */}
                            <div className="w-16 h-1.5 rounded-full bg-white/8 overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  sl.availableUnits === 0
                                    ? "bg-red-500"
                                    : sl.availableUnits <= 3
                                    ? "bg-amber-400"
                                    : "bg-[#e8ff47]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`font-syne font-700 ${statusColor}`}>
                              {sl.availableUnits === 0 ? "Out" : sl.availableUnits}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
