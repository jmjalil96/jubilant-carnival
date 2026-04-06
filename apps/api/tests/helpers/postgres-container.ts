import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";

const POSTGRES_DB = "jubilant_carnival_test";
const POSTGRES_PASSWORD = "postgres";
const POSTGRES_USER = "postgres";

export type StartedPostgresContainer = {
  container: StartedTestContainer;
  connectionString: string;
};

export async function startPostgresContainer(): Promise<StartedPostgresContainer> {
  const container = await new GenericContainer("postgres:17")
    .withEnvironment({
      POSTGRES_DB,
      POSTGRES_PASSWORD,
      POSTGRES_USER,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(
      Wait.forLogMessage("database system is ready to accept connections"),
    )
    .start();

  const connectionString = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
    5432,
  )}/${POSTGRES_DB}`;

  return {
    container,
    connectionString,
  };
}
