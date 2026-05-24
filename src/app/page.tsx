// src/app/page.tsx
import { ProductWithStock } from "@/types";
import ProductGrid from "@/components/ProductGrid";
import { prisma } from "@/lib/prisma";
import { expireStaleReservations } from "@/lib/expiry";

async function getProducts(): Promise<ProductWithStock[]> {
  await expireStaleReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: { warehouse: true },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    price: p.price.toString(),
    stockLevels: p.stockLevels.map((sl) => ({
      ...sl,
      availableUnits: Math.max(0, sl.totalUnits - sl.reservedUnits),
    })),
  }));
}

export default async function HomePage() {
  let products: ProductWithStock[] = [];
  let error: string | null = null;

  try {
    products = await getProducts();
  } catch (e) {
    console.error("Failed to load products:", e);
    error = "Unable to load products. Please refresh the page.";
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-16">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px w-8 bg-[#e8ff47]" />
          <span className="text-[#e8ff47] text-xs font-syne font-600 tracking-widest uppercase">
            Live Inventory
          </span>
        </div>
        <h1 className="font-syne font-800 text-5xl md:text-6xl leading-[1.05] tracking-tight text-white mb-4">
          Reserve before
          <br />
          <span className="text-[#e8ff47]">someone else does.</span>
        </h1>
        <p className="text-white/50 font-dm-sans text-lg max-w-xl leading-relaxed">
          Stock is held for 10 minutes while you complete checkout. Units
          released automatically if payment doesn't go through.
        </p>
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <p className="text-red-400 font-dm-sans">{error}</p>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </main>
  );
}
