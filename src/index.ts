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
    now: new Date().toLocaleString(),
  });
});

app.get("/partials/time", (_req, res) => {
  res.status(200).render("partials/time", {
    now: new Date().toLocaleString(),
  });
});

app.listen(config.port, () => {
  logger.info(`Starting ${config.appName} (${config.nodeEnv})`);
  logger.info(`Listening on http://localhost:${config.port}`);
});
