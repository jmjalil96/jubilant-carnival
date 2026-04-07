import type { AuthenticatedRequestContext } from "../modules/auth/shared/contracts.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedRequestContext | null;
    }
  }
}

export {};
