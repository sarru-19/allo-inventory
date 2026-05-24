// src/lib/schemas.ts
import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1").max(100),
  customerRef: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationIdSchema = z.object({
  id: z.string().min(1),
});
