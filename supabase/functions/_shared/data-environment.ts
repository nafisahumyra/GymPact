export type DataEnvironment = "production" | "dev";

export function getDataEnvironment(value: unknown): DataEnvironment | null {
  return value === undefined || value === null || value === "production"
    ? "production"
    : value === "dev" ? "dev" : null;
}

export function requireDataEnvironment(value: unknown): DataEnvironment {
  const environment = getDataEnvironment(value);
  if (!environment) throw new Error("Invalid data environment.");
  return environment;
}
