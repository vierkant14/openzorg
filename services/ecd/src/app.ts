import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { pool } from "./lib/db.js";
import { auditMiddleware } from "./middleware/audit.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { allergieRoutes } from "./routes/allergie.js";
import { apiDocsRoutes } from "./routes/api-docs.js";
import { berichtenRoutes } from "./routes/berichten.js";
import { capaciteitRoutes } from "./routes/capaciteit.js";
import { clientRoutes } from "./routes/client.js";
import { codelijstenRoutes } from "./routes/codelijsten.js";
import { configuratieRoutes } from "./routes/configuratie.js";
import { contactpersoonRoutes } from "./routes/contactpersoon.js";
import { contractenRoutes } from "./routes/contracten.js";
import { diagnoseRoutes } from "./routes/diagnose.js";
import { documentenRoutes } from "./routes/documenten.js";
import { healthRoutes } from "./routes/health.js";
import { integratieRoutes } from "./routes/integraties.js";
import { masterAdminRoutes } from "./routes/master-admins.js";
import { mdoRoutes } from "./routes/mdo.js";
import { medewerkerRoutes } from "./routes/medewerkers.js";
import { medicatieOverzichtRoutes } from "./routes/medicatie-overzicht.js";
import { medicatieRoutes } from "./routes/medicatie.js";
import { micMeldingRoutes } from "./routes/mic-melding.js";
import { organisatieRoutes } from "./routes/organisatie.js";
import { rapportageRoutes } from "./routes/rapportage.js";
import { risicoscreeningRoutes } from "./routes/risicoscreening.js";
import { roosterRoutes } from "./routes/rooster.js";
import { signaleringRoutes } from "./routes/signaleringen.js";
import { tenantSettingsRoutes } from "./routes/tenant-settings.js";
import { tenantRoutes } from "./routes/tenants.js";
import { toedieningRoutes } from "./routes/toediening.js";
import { vaccinatieRoutes } from "./routes/vaccinatie.js";
import { vbmRoutes } from "./routes/vbm.js";
import { vragenlijstenRoutes } from "./routes/vragenlijsten.js";
import { wilsverklaringRoutes } from "./routes/wilsverklaring.js";
import { workflowTriggerRoutes } from "./routes/workflow-triggers.js";
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

// Toedienregistratie (MedicationAdministration)
app.route("/api/clients", toedieningRoutes);

// Vaccinaties (Immunization)
app.route("/api/clients", vaccinatieRoutes);

// Wilsverklaringen / BOPZ-status (Consent)
app.route("/api/clients", wilsverklaringRoutes);

// Medicatieoverzicht (MedicationStatement)
app.route("/api/clients", medicatieOverzichtRoutes);

// MDO / Overleggen (Encounter)
app.route("/api/clients", mdoRoutes);

// Vrijheidsbeperkende maatregelen (Procedure)
app.route("/api/clients", vbmRoutes);
app.route("/api/vbm", vbmRoutes);

// MIC Meldingen (Incident reports)
app.route("/api/mic-meldingen", micMeldingRoutes);

// Vragenlijsten (Questionnaire + QuestionnaireResponse)
app.route("/api/vragenlijsten", vragenlijstenRoutes);
app.route("/api", vragenlijstenRoutes);

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

// Sprint 5: Contracten, Rooster, Capaciteit
app.route("/api/contracten", contractenRoutes);
app.route("/api/rooster", roosterRoutes);
app.route("/api/capaciteit", capaciteitRoutes);

// Signaleringen (Flag) — client alerts
app.route("/api/clients", signaleringRoutes);
app.route("/api/signaleringen", signaleringRoutes);

// Admin: Workflow triggers
app.route("/api/admin/workflow-triggers", workflowTriggerRoutes);

// Sprint 6: API docs, Integraties (webhooks + API keys)
app.route("/api/docs", apiDocsRoutes);
app.route("/api/admin/integraties", integratieRoutes);

// Master admin check-admin endpoint (no auth required, called during login)
app.get("/api/master/check-admin", async (c) => {
  const email = c.req.query("email");
  if (!email) {
    return c.json({ isMaster: false });
  }
  const result = await pool.query(
    "SELECT id FROM openzorg.master_admins WHERE email = $1",
    [email.toLowerCase()],
  );
  return c.json({ isMaster: result.rows.length > 0 });
});

// Master admin: tenant management (no tenant context required)
// Protected by X-Master-Key header in production
// check-admin is exempt (called during login without auth)
app.use("/api/master/*", async (c, next): Promise<Response | void> => {
  if (c.req.path.startsWith("/api/master/check-admin")) {
    await next();
    return;
  }
  const masterKey = c.req.header("X-Master-Key");
  const expectedKey = process.env["MASTER_ADMIN_KEY"] || "dev-master-key";
  if (masterKey !== expectedKey) {
    return c.json({ error: "Master admin toegang vereist" }, 403);
  }
  await next();
});
app.route("/api/master/tenants", tenantRoutes);
app.route("/api/master/admins", masterAdminRoutes);
