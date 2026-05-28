# Style Guide & Templates

> **Purpose:** Code conventions, templates, and naming rules for this project.
> Referenced by [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).
> Read on demand — not loaded automatically.

---

## Module Template

Every feature module must follow this structure:

```ts
// src/feature.ts — <One-line purpose>
// <What it reads/writes, dependencies.>

import { logger } from "./logger.js";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export interface FeatureResult {
  id: number;
  value: string;
}

// ────────────────────────────────────────────────
// Core logic (pure functions — no I/O)
// ────────────────────────────────────────────────

export function processItem(input: string): FeatureResult {
  // ...
  return { id: 1, value: input.trim() };
}

// ────────────────────────────────────────────────
// I/O layer
// ────────────────────────────────────────────────

export async function runFeature(inputPath: string): Promise<FeatureResult[]> {
  logger.debug(`Processing: ${inputPath}`);
  // ...
  logger.info(`Done. N items processed.`);
  return [];
}
```

---

## Entry Point Template

```ts
// src/index.ts — Application entry point

import { logger } from "./logger.js";
import { config } from "./config.js";

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

async function main() {
  logger.info(`Starting ${config.appName} on port ${config.port}`);

  // ... startup logic ...

  logger.info("Ready.");
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
```

---

## Express Route Template

```ts
// src/routes/items.ts

import { Router, Request, Response } from "express";
import { logger } from "../logger.js";

const router = Router();

router.get("/items", async (req: Request, res: Response) => {
  try {
    const data = await getItems();
    res.json({ ok: true, data });
  } catch (err) {
    logger.error(`GET /items failed: ${err}`);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

export default router;
```

---

## Config Template

```ts
// src/config.ts — Typed, validated environment config

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  appName: process.env.APP_NAME ?? "my-app",
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",
  // dbUrl: requireEnv("DATABASE_URL"),  // uncomment for required vars
} as const;
```

---

## Naming Conventions

### Files
- Modules: `kebab-case.ts` — `user-service.ts`, `auth-middleware.ts`
- Types/interfaces file: `types.ts` or `<feature>.types.ts`
- Tests: `<module>.test.ts`

### Symbols
- Classes/interfaces/types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` for module-level config; `camelCase` for local consts
- Private class members: prefix with `#` (native private fields) or `_` (convention)

---

## Logger Calls — When to Use Which Level

| Level | When to use | Example |
|---|---|---|
| `logger.debug()` | Per-request or per-item detail | `logger.debug(\`Processing item ${id}\`)` |
| `logger.info()` | Summaries, startup/shutdown | `logger.info(\`Server started on port ${port}\`)` |
| `logger.warn()` | Recoverable issue, fallback used | `logger.warn(\`Cache miss for ${key}, fetching from DB\`)` |
| `logger.error()` | Caught errors, fatal issues | `logger.error(\`DB query failed: ${err.message}\`)` |

---

## API Response Shape

```ts
// Always use this shape for API responses

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Helper
export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}
export function fail(error: string): ApiResponse<never> {
  return { ok: false, error };
}
```

---

## Comment Banners

Use these to visually separate sections within a module:

```ts
// ────────────────────────────────────────────────
// Section Title
// ────────────────────────────────────────────────
```

Use `// TODO(feature-X):` for planned work tied to a feature ID from `plan.md`:
```ts
// TODO(feature-B): Add pagination here
```
