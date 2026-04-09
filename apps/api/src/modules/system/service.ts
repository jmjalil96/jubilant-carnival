import {
  SERVICE_NOT_READY_ERROR_CODE,
  type SystemStatus,
} from "@jubilant-carnival/contracts";
import { AppError } from "../../http/errors.js";

type SystemServiceDependencies = {
  checkReadiness: () => Promise<void>;
};

export function createSystemService({
  checkReadiness,
}: SystemServiceDependencies) {
  return {
    getHealthStatus(): SystemStatus {
      return { status: "ok" };
    },
    async getReadinessStatus(): Promise<SystemStatus> {
      try {
        await checkReadiness();
      } catch {
        throw new AppError({
          statusCode: 503,
          code: SERVICE_NOT_READY_ERROR_CODE,
          message: "Service is not ready",
        });
      }

      return { status: "ok" };
    },
  };
}
