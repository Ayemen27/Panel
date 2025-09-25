import { type Express } from "express";
import { createServer } from "http";

export async function registerRoutes(app: Express) {
  // API routes can be added here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Create HTTP server for WebSocket support
  const server = createServer(app);

  return server;
}