// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        id: "wh_mumbai",
        name: "Mumbai Central",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        id: "wh_delhi",
        name: "Delhi North",
        location: "Delhi, NCR",
      },
    }),
    prisma.warehouse.create({
      data: {
        id: "wh_bangalore",
        name: "Bangalore Tech Park",
        location: "Bangalore, Karnataka",
      },
    }),
  ]);

  console.log(`✅ Created ${warehouses.length} warehouses`);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        id: "prod_airmax",
        name: "Air Max Pro Runner",
        sku: "SHOE-AMP-001",
        description:
          "Lightweight performance running shoe with reactive foam cushioning and breathable upper mesh.",
        imageUrl:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
        price: 8999.0,
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_hoodie",
        name: "Oversized Fleece Hoodie",
        sku: "APP-OFH-002",
        description:
          "Premium 400gsm fleece hoodie with kangaroo pocket and ribbed cuffs. Garment-washed for a lived-in feel.",
        imageUrl:
          "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80",
        price: 3499.0,
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_watch",
        name: "Meridian Field Watch",
        sku: "ACC-MFW-003",
        description:
          "Japanese automatic movement, sapphire crystal, 100m water resistance. Canvas strap included.",
        imageUrl:
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
        price: 24999.0,
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_backpack",
        name: "Urban Commuter Pack 26L",
        sku: "BAG-UCP-004",
        description:
          "Waterproof 26L daypack with padded laptop sleeve, hidden back pocket, and magnetic buckle system.",
        imageUrl:
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
        price: 5499.0,
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_headphones",
        name: "Studio Monitor Headphones",
        sku: "AUD-SMH-005",
        description:
          "40mm drivers, 32Ω impedance, detachable cable. Closed-back design for studio and commute use.",
        imageUrl:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
        price: 12999.0,
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_keyboardlim",
        name: "Mechanical Keyboard TKL",
        sku: "TECH-MKT-006",
        description:
          "Tenkeyless hot-swap board with POM plate, south-facing RGB, and per-key customisation via open-source firmware.",
        imageUrl:
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
        price: 9999.0,
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // Create stock levels — intentionally low for some to demonstrate 409 errors
  const stockData = [
    // Air Max Pro Runner
    { productId: "prod_airmax", warehouseId: "wh_mumbai", totalUnits: 15 },
    { productId: "prod_airmax", warehouseId: "wh_delhi", totalUnits: 8 },
    { productId: "prod_airmax", warehouseId: "wh_bangalore", totalUnits: 3 },

    // Oversized Fleece Hoodie
    { productId: "prod_hoodie", warehouseId: "wh_mumbai", totalUnits: 22 },
    { productId: "prod_hoodie", warehouseId: "wh_delhi", totalUnits: 0 },
    { productId: "prod_hoodie", warehouseId: "wh_bangalore", totalUnits: 11 },

    // Meridian Field Watch
    { productId: "prod_watch", warehouseId: "wh_mumbai", totalUnits: 2 },
    { productId: "prod_watch", warehouseId: "wh_delhi", totalUnits: 1 },
    { productId: "prod_watch", warehouseId: "wh_bangalore", totalUnits: 0 },

    // Urban Commuter Pack
    { productId: "prod_backpack", warehouseId: "wh_mumbai", totalUnits: 18 },
    { productId: "prod_backpack", warehouseId: "wh_delhi", totalUnits: 7 },
    {
      productId: "prod_backpack",
      warehouseId: "wh_bangalore",
      totalUnits: 14,
    },

    // Studio Monitor Headphones
    {
      productId: "prod_headphones",
      warehouseId: "wh_mumbai",
      totalUnits: 5,
    },
    { productId: "prod_headphones", warehouseId: "wh_delhi", totalUnits: 3 },
    {
      productId: "prod_headphones",
      warehouseId: "wh_bangalore",
      totalUnits: 1,
    },

    // Mechanical Keyboard — very limited!
    {
      productId: "prod_keyboardlim",
      warehouseId: "wh_mumbai",
      totalUnits: 1,
    },
    { productId: "prod_keyboardlim", warehouseId: "wh_delhi", totalUnits: 0 },
    {
      productId: "prod_keyboardlim",
      warehouseId: "wh_bangalore",
      totalUnits: 0,
    },
  ];

  const stockLevels = await Promise.all(
    stockData.map((s) =>
      prisma.stockLevel.create({
        data: { ...s, reservedUnits: 0 },
      })
    )
  );

  console.log(`✅ Created ${stockLevels.length} stock level entries`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
