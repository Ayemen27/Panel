import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Node.js environment
neonConfig.webSocketConstructor = ws;

// Configure Neon to handle connection issues better
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Add connection pool configuration for better stability
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
export const db = drizzle({ client: pool, schema });