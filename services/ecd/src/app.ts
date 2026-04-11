import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auditMiddleware } from "./middleware/audit.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { allergieRoutes } from "./routes/allergie.js";
import { diagnoseRoutes } from "./routes/diagnose.js";
import { risicoscreeningRoutes } from "./routes/risicoscreening.js";
import { tenantSettingsRoutes } from "./routes/tenant-settings.js";
import { tenantRoutes } from "./routes/tenants.js";
import { berichtenRoutes } from "./routes/berichten.js";
import { clientRoutes } from "./routes/client.js";
import { codelijstenRoutes } from "./routes/codelijsten.js";
import { configuratieRoutes } from "./routes/configuratie.js";
import { contactpersoonRoutes } from "./routes/contactpersoon.js";
import { documentenRoutes } from "./routes/documenten.js";
import { healthRoutes } from "./routes/health.js";
import { medicatieRoutes } from "./routes/medicatie.js";
import { medewerkerRoutes } from "./routes/medewerkers.js";
import { micMeldingRoutes } from "./routes/mic-melding.js";
import { organisatieRoutes } from "./routes/organisatie.js";
import { rapportageRoutes } from "./routes/rapportage.js";
import { zorgplanRoutes } from "./routes/zorgplan.js";

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
app.use("/api/*", rbacMiddleware);
app.use("/api/*", auditMiddleware);

app.get("/api/status", (c) => {
  return c.json({
    service: "ecd",
    tenantId: c.get("tenantId"),
    status: "ok",
  });
});

// Client (Patient) CRUD
app.route("/api/clients", clientRoutes);

// Contactpersoon (RelatedPerson) — mounted at /api to preserve nested paths
app.route("/api", contactpersoonRoutes);

// Zorgplan (CarePlan, Goal, ServiceRequest)
app.route("/api", zorgplanRoutes);

// Rapportage (Clinical notes)
app.route("/api", rapportageRoutes);

// Documenten (Document upload)
app.route("/api", documentenRoutes);

// Medicatie (MedicationRequest)
app.route("/api", medicatieRoutes);

// Allergieen (AllergyIntolerance)
app.route("/api/clients", allergieRoutes);

// Diagnoses (Condition)
app.route("/api/clients", diagnoseRoutes);

// Risicoscreenings (RiskAssessment)
app.route("/api/clients", risicoscreeningRoutes);

// MIC Meldingen (Incident reports)
app.route("/api/mic-meldingen", micMeldingRoutes);

// Admin configuratie (custom fields, validation rules)
app.route("/api/admin", configuratieRoutes);

// Admin codelijsten (SNOMED-gebaseerde term management)
app.route("/api/admin/codelijsten", codelijstenRoutes);

// Medewerkers (Practitioner management)
app.route("/api/medewerkers", medewerkerRoutes);

// Organisatie (Organization hierarchy)
app.route("/api/organisatie", organisatieRoutes);

// Berichten (Communication / notifications)
app.route("/api/berichten", berichtenRoutes);

// Tenant settings (current tenant context)
app.route("/api/tenant-settings", tenantSettingsRoutes);

// Master admin: tenant management (no tenant context required)
// Protected by X-Master-Key header in production
app.use("/api/master/*", async (c, next): Promise<Response | void> => {
  const masterKey = c.req.header("X-Master-Key");
  const expectedKey = process.env["MASTER_ADMIN_KEY"] || "dev-master-key";
  if (masterKey !== expectedKey) {
    return c.json({ error: "Master admin toegang vereist" }, 403);
  }
  await next();
});
app.route("/api/master/tenants", tenantRoutes);
