import pino, { type Logger, type LoggerOptions } from "pino";
import { pinoHttp } from "pino-http";

type LoggerConfig = {
  logLevel: string;
  nodeEnv: "development" | "test" | "production";
};

export function createLogger({ logLevel, nodeEnv }: LoggerConfig): Logger {
  const loggerOptions: LoggerOptions = {
    level: logLevel,
  };

  if (nodeEnv === "development") {
    loggerOptions.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    };
  }

  return pino(loggerOptions);
}

export function createHttpLogger({ logger }: { logger: Logger }) {
  return pinoHttp({
    logger,
  });
}
