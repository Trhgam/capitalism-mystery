import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const healthStatus = () => ({ ok: true, service: "capitalism-mystery" });

export function createApp({ clientOrigin }) {
  const app = express();
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json());
  app.get("/api/health", (_req, res) => res.json(healthStatus()));

  const here = dirname(fileURLToPath(import.meta.url));
  const clientDist = resolve(here, "../../client/dist");
  if (existsSync(resolve(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => res.sendFile(resolve(clientDist, "index.html")));
  }
  return app;
}
