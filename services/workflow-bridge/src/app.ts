import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { tenantMiddleware } from "./middleware/tenant.js";
import { bpmnTemplateRoutes } from "./routes/bpmn-templates.js";
import { healthRoutes } from "./routes/health.js";
import { processenRoutes } from "./routes/processen.js";
import { takenRoutes } from "./routes/taken.js";

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
    service: "workflow-bridge",
    tenantId: c.get("tenantId"),
    status: "ok",
  });
});

// Process definitions & instances
app.route("/api/processen", processenRoutes);

// Task inbox (werkbak)
app.route("/api/taken", takenRoutes);

// BPMN templates
app.route("/api/bpmn-templates", bpmnTemplateRoutes);
