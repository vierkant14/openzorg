import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { bpmnTemplateRoutes } from "./routes/bpmn-templates.js";
import { catalogusRoutes } from "./routes/catalogus.js";
import { healthRoutes } from "./routes/health.js";
import { processenRoutes } from "./routes/processen.js";
import { takenRoutes } from "./routes/taken.js";

export type AppEnv = {
  Variables: {
    tenantId: string;
    /** Practitioner-ID zonder resource-prefix (uit het geverifieerde token). */
    userId: string;
    /** Volledige profile-reference, bv. "Practitioner/abc" (voor audit). */
    userRef: string;
    /** Medplum project-ID van het token. */
    projectId: string;
  };
};

export const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors());

// Health check does not require tenant context
app.route("/health", healthRoutes);

// Alle API-routes: eerst token-verificatie (401/403), dan tenant-context (400)
app.use("/api/*", authMiddleware);
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

// Proces-catalogus (domeintaal, Laag 1 ⊕ Laag 2)
app.route("/api/catalogus", catalogusRoutes);
