
import { Express } from "express";
import { createServer } from "http";
import { registerRoutes } from "../routes.js";

// Re-export the main registerRoutes function
export { registerRoutes };

// Export individual route modules if needed
export * from "./realFiles.js";
