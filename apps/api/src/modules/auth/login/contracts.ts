import { z } from "zod";
import type { CurrentSessionResponse } from "../shared/contracts.js";

export const createSessionBodySchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1_024),
});

export type LoginResponse = CurrentSessionResponse;
