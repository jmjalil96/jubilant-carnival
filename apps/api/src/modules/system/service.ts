import { AppError } from "../../http/errors.js";

type SystemStatusResponse = {
  status: "ok";
};

type SystemServiceDependencies = {
  checkReadiness: () => Promise<void>;
};

export function createSystemService({
  checkReadiness,
}: SystemServiceDependencies) {
  return {
    getHealthStatus(): SystemStatusResponse {
      return { status: "ok" };
    },
    async getReadinessStatus(): Promise<SystemStatusResponse> {
      try {
        await checkReadiness();
      } catch {
        throw new AppError({
          statusCode: 503,
          code: "service_not_ready",
          message: "Service is not ready",
        });
      }

      return { status: "ok" };
    },
  };
}
