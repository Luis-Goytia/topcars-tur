import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import productsRouter from "../routes/productsRoutes";
import { createSwaggerRouter } from "./swagger";

dotenv.config();

export function createApp() {
  const app = express();

  // Basic middlewares
  app.use(express.json());
  app.use(
    cors({
      origin: "*",
    }),
  );

  // Static front-end
  const publicDir = path.join(__dirname, "..", "..", "public");
  app.use(express.static(publicDir));

  // API routes
  app.use("/products", productsRouter);

  // Swagger / API docs
  app.use("/api-docs", createSwaggerRouter());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Not found handler for API (basic)
  app.use((req, res, _next) => {
    if (req.path.startsWith("/products") || req.path.startsWith("/api-docs")) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.sendFile(path.join(publicDir, "index.html"));
  });

  // Generic error handler
  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // Do not leak internals or API keys
      // Log minimal info; in real project, use a logger
      // eslint-disable-next-line no-console
      console.error("Unhandled error", err);
      if (err?.status === 404) {
        return res.status(404).json({ error: err.message ?? "Not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}

