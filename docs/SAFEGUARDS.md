# Safeguards & Error Prevention

> **Purpose:** Prevent recurring errors. Every rule here exists because it was hit
> during development or is a known risk for this type of project.
> **Audience:** Copilot, contributors, and future-you at 2 AM.

---

## S1 — TypeScript Strict Mode

### Problem
Without strict mode, TypeScript silently allows `null`/`undefined` dereferences, implicit `any`,
and other type holes that cause runtime crashes.

### Rules

1. **`"strict": true` in `tsconfig.json`.** Never disable `strictNullChecks` or `noImplicitAny`.

2. **No `any` without justification.** If you must use `any`, add a comment explaining why.
   Use `unknown` instead when the type is genuinely unknown — it forces explicit narrowing.
   ```ts
   // ✅ CORRECT — unknown forces narrowing
   function parse(input: unknown): string {
     if (typeof input !== "string") throw new Error("expected string");
     return input;
   }

   // ❌ WRONG — any disables type checking silently
   function parse(input: any): string { return input; }
   ```

3. **Narrow types at boundaries.** Validate external data (request bodies, env vars, parsed JSON)
   immediately at entry points using type guards or a schema validator (e.g. zod).

---

## S2 — Error Handling

### Problem
Swallowed errors and unhandled promise rejections are silent failures that are extremely hard to debug.

### Rules

1. **Never swallow errors.** Every `catch` block must log or re-throw.
   ```ts
   // ✅ CORRECT
   try {
     await doWork();
   } catch (err) {
     logger.error(`doWork failed: ${err}`);
     throw err; // or handle gracefully
   }

   // ❌ WRONG — error disappears
   try { await doWork(); } catch {}
   ```

2. **Always handle Promise rejections.** Use `async/await` + `try/catch`. Avoid floating promises.
   ```ts
   // ✅ CORRECT
   await doSomething();

   // ❌ WRONG — rejection is unhandled
   doSomething();
   ```

3. **Set a global unhandled rejection handler** in the entry point:
   ```ts
   process.on("unhandledRejection", (reason) => {
     logger.error(`Unhandled rejection: ${reason}`);
     process.exit(1);
   });
   ```

---

## S3 — Configuration & Secrets

### Problem
Hardcoded config values break across environments and may leak secrets into version control.

### Rules

1. **All config comes from environment variables.** Use a typed `config.ts` module:
   ```ts
   // src/config.ts
   export const config = {
     port: parseInt(process.env.PORT ?? "3000", 10),
     dbUrl: process.env.DATABASE_URL ?? "sqlite://./dev.db",
     nodeEnv: process.env.NODE_ENV ?? "development",
   } as const;
   ```

2. **Never commit `.env` files.** Add `.env` and `.env.local` to `.gitignore`.
   Commit a `.env.example` with placeholder values.

3. **Validate required env vars at startup.** Exit with an error if a required variable is missing.

---

## S4 — Logging

### Problem
`console.log()` doesn't support log levels, timestamps, or file output.

### Rules

1. **Never use `console.log/warn/error` in application code.** Use the project logger.

2. **`logger.debug()` for per-request or per-item detail.** Keep `logger.info()` for summaries.

3. **`logger.error()` for all caught errors.** Include the error object or message.

4. **`logger.warn()` for recoverable issues** (e.g. fallback used, optional resource missing).

---

## S5 — API Response Shape

### Problem
Inconsistent response shapes force every client to guess whether `data` or `error` is present.

### Rule

**Every API route returns the `{ok, data, error}` envelope:**
```ts
// Success
res.json({ ok: true, data: result });

// Failure
res.status(400).json({ ok: false, error: "Validation failed: missing 'name'" });
```

Never return `null`, raw data, or a different shape from an API route.

---

## S6 — Module Boundaries

### Problem
Circular imports and tight coupling between modules cause build failures and make testing impossible.

### Rules

1. **No circular imports.** If A imports B and B imports A, extract a shared module C.

2. **Don't import implementation details.** Import only the public API of a module.

3. **`logger.ts` and `config.ts` have no project-internal dependencies.** They are the base layer.

---

## S7 — Build And Runtime Consistency

### Problem
Mixed build assumptions (compiled output vs runtime transpilation) cause broken start commands.

### Rules

1. **Use one runtime mode consistently per template.** This template runs from TypeScript source with `tsx`.

2. **`src/` contains only source files.** No generated `.js` files in `src/`.

3. **`make build` performs type-checking (`tsc --noEmit`).** Keep this check in CI before deployment.
