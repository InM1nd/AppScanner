export function assertE2EDatabaseUrl(value = process.env.DATABASE_URL): void {
  if (!value) throw new Error("DATABASE_URL is required for E2E tests");

  let databaseName: string | undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      throw new Error();
    databaseName = decodeURIComponent(url.pathname)
      .split("/")
      .filter(Boolean)
      .at(-1);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL for E2E tests",
    );
  }

  if (!databaseName?.endsWith("_e2e")) {
    throw new Error(
      "Refusing E2E database access: database name must end with _e2e",
    );
  }
}
