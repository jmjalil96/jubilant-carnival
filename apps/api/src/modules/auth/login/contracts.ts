import { z } from "zod";

export const createSessionBodySchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1_024),
});

export type CreateSessionBody = z.output<typeof createSessionBodySchema>;

export type LoginResponse = {
  actor: {
    user: {
      id: string;
      email: string;
      displayName: string | null;
    };
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    roleKeys: string[];
  };
  session: {
    expiresAt: string;
  };
};
