import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { tenantMiddleware } from "./middleware/tenant.js";
import { afspraakRoutes } from "./routes/afspraak.js";
import { beschikbaarheidRoutes } from "./routes/beschikbaarheid.js";
import { bezettingRoutes } from "./routes/bezetting.js";
import { contractRoutes } from "./routes/contract.js";
import { dagplanningRoutes } from "./routes/dagplanning.js";
import { dienstConfigRoutes } from "./routes/dienst-config.js";
import { healthRoutes } from "./routes/health.js";
import { herhalingRoutes } from "./routes/herhaling.js";
import { planningEngineRoutes } from "./routes/planning-engine.js";
import { wachtlijstRoutes } from "./routes/wachtlijst.js";

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
    service: "planning",
    tenantId: c.get("tenantId"),
    status: "ok",
  });
});

// PLN-01: Afspraken (Appointment CRUD)
app.route("/api/afspraken", afspraakRoutes);

// PLN-02: Dagplanning (Daily schedule)
app.route("/api/dagplanning", dagplanningRoutes);

// PLN-03: Herhalingen (Recurring appointments)
app.route("/api/herhalingen", herhalingRoutes);

// PLN-04: Beschikbaarheid (Practitioner availability)
app.route("/api/beschikbaarheid", beschikbaarheidRoutes);

// PLN-05: Wachtlijst (Waiting list)
app.route("/api/wachtlijst", wachtlijstRoutes);

// PLN-06: Contract-uren (Medewerker contract info)
app.route("/api/medewerkers", contractRoutes);

// PLN-07: Dienst-configuratie (Shift type config with inheritance)
app.route("/api/dienst-config", dienstConfigRoutes);

// PLN-08: Bezettingsprofiel (Staffing requirements per afdeling per dienst)
app.route("/api/bezetting", bezettingRoutes);

// PLN-09: Planning engine (constraint solver: validate, optimaliseer, genereer)
app.route("/api/planning-engine", planningEngineRoutes);
