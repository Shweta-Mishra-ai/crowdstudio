import "dotenv/config";
import type { SignOptions } from "jsonwebtoken";

function required(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (!val) {
    // Fail fast at boot instead of silently using an insecure default
    // (this was a real bug class in the old crowdstudio JWT_SECRET setup).
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? required("JWT_SECRET") : "dev-jwt-secret-crowdstudio-2026"),
  // Typed as SignOptions["expiresIn"] (not plain string) — jsonwebtoken's
  // types only accept a number of seconds or a specific "Xd"/"Xh" style
  // literal, and a loose `string` fails to satisfy jwt.sign's overloads.
  jwtExpiry: (process.env.JWT_EXPIRY ?? "7d") as SignOptions["expiresIn"],
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: process.env.DATABASE_URL || (process.env.NODE_ENV === "production" ? required("DATABASE_URL") : "postgresql://crowdstudio:crowdstudio@localhost:5432/crowdstudio"),
  // Optional: only set if the user wants real paid AI export.
  // When absent, the export route returns a clear "not configured" error
  // instead of faking a result.
  aiExportApiKey: process.env.AI_EXPORT_API_KEY ?? null,
  aiExportProvider: process.env.AI_EXPORT_PROVIDER ?? null, // e.g. "suno" | "elevenlabs"
  // Configurable so tests can use a short timeout instead of waiting out
  // the real 30s production default on every "provider hangs" test case.
  aiExportTimeoutMs: Number(process.env.AI_EXPORT_TIMEOUT_MS ?? 30_000),
};
