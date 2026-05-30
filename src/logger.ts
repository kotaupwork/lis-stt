// src/logger.ts — Shared dev logger
//
// Usage in any module:
//   import { logger } from "./logger.js";
//   logger.info("Starting...");
//   logger.debug("Detail only shown when LOG_LEVEL=debug");
//   logger.warn("Something unexpected");
//   logger.error("Fatal problem");

import fs from "node:fs";
import path from "node:path";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ────────────────────────────────────────────────
// ANSI colors
// ────────────────────────────────────────────────

const C = {
  debug: "\x1b[90m", // gray
  info: "\x1b[94m", // blue
  warn: "\x1b[93m", // yellow
  error: "\x1b[91m", // red
  bold: "\x1b[1m",
  reset: "\x1b[0m",
} as const;

// ────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────

const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info") as LogLevel;
const LOG_DIR = process.env.LOG_DIR ?? "logs";
const SCRIPT_NAME = process.env.npm_lifecycle_event ?? "app";

// ────────────────────────────────────────────────
// File output (optional — skipped if LOG_DIR unavailable)
// ────────────────────────────────────────────────

let _logStream: fs.WriteStream | null = null;

function getLogStream(): fs.WriteStream | null {
  if (_logStream) return _logStream;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const logPath = path.join(LOG_DIR, `${SCRIPT_NAME}-${timestamp}.log`);
    _logStream = fs.createWriteStream(logPath, {
      flags: "a",
      encoding: "utf-8",
    });
    return _logStream;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────
// Core log function
// ────────────────────────────────────────────────

function log(level: LogLevel, msg: string): void {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const ts = new Date().toTimeString().slice(0, 8);
  const label = level.toUpperCase().padEnd(5);
  const color = C[level];

  // Console output (stderr for warn/error, stdout for info/debug)
  const consoleLine = `${C.bold}[${ts}]${C.reset} ${color}${label}${C.reset}  ${msg}`;
  if (level === "warn" || level === "error") {
    process.stderr.write(consoleLine + "\n");
  } else {
    process.stdout.write(consoleLine + "\n");
  }

  // File output — plain text, no ANSI
  const stream = getLogStream();
  if (stream) {
    stream.write(`[${ts}] ${label}  ${msg}\n`);
  }
}

// ────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────

export const logger = {
  debug: (msg: string) => log("debug", msg),
  info: (msg: string) => log("info", msg),
  warn: (msg: string) => log("warn", msg),
  error: (msg: string) => log("error", msg),
};
