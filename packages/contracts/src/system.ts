import { z } from "zod";

export const systemStatusSchema = z.object({
  status: z.literal("ok"),
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;
