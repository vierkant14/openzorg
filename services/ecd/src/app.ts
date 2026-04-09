import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { tenantMiddleware } from "./middleware/tenant.js";
import { healthRoutes } from "./routes/health.js";

export type AppEnv = {
  Variables: {
    tenantId: string;
  };
};

export const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors());

// Health check does not require tenant context
app.route("/health", healthRoutes);

// All other routes require tenant context
app.use("/api/*", tenantMiddleware);

app.get("/api/status", (c) => {
  return c.json({
    service: "ecd",
    tenantId: c.get("tenantId"),
    status: "ok",
  });
});
