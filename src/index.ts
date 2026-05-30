import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { logger } from "./logger.js";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res
    .status(200)
    .json({ ok: true, service: config.appName, env: config.nodeEnv });
});

app.get("/", (_req, res) => {
  res.status(200).render("index", {
    appName: config.appName,
    sttBackendUrl: config.sttBackendUrl,
  });
});

const MAX_PORT_ATTEMPTS = 20;

function startServer(port: number, attempt = 0): void {
  const server = app.listen(port, () => {
    logger.info(`Starting ${config.appName} (${config.nodeEnv})`);
    logger.info(`Listening on http://localhost:${port}`);
  });

  server.on("error", (err: unknown) => {
    const error = err as NodeJS.ErrnoException;

    if (error.code === "EADDRINUSE" && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      logger.warn(`Port ${port} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    throw err;
  });
}

startServer(config.port);
