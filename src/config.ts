// src/config.ts — Typed, validated environment configuration
//
// All config comes from environment variables.
// Set values in .env (development) or via the deployment environment (production).
// See .env.example for required variables.

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

// Uncomment and use for required env vars that have no sensible default:
// function requireEnv(name: string): string {
//   const val = process.env[name];
//   if (!val) throw new Error(`Missing required env var: ${name}`);
//   return val;
// }

// ────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────

export const config = {
  appName: process.env.APP_NAME ?? "my-htmx-app",
  port: parseInt(process.env.PORT ?? "3000", 10),
  sttBackendUrl: process.env.STT_BACKEND_URL ?? "http://localhost:8000",
  nodeEnv: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "production"
    | "test",
  logLevel: process.env.LOG_LEVEL ?? "info",
  // Add your project-specific config here, e.g.:
  // dbUrl: requireEnv("DATABASE_URL"),
} as const;
