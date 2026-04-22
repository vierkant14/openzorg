import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { pool } from "./lib/db.js";
import { auditMiddleware } from "./middleware/audit.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { aiSettingsRoutes } from "./routes/ai-settings.js";
import { aiRoutes } from "./routes/ai.js";
import { auditLogRoutes } from "./routes/audit-log.js";
import { allergieRoutes } from "./routes/allergie.js";
import { apiDocsRoutes } from "./routes/api-docs.js";
import { berichtenRoutes } from "./routes/berichten.js";
import { capaciteitRoutes } from "./routes/capaciteit.js";
import { clientRoutes } from "./routes/client.js";
import { codelijstenRoutes } from "./routes/codelijsten.js";
import { configuratieRoutes } from "./routes/configuratie.js";
import { contactpersoonRoutes } from "./routes/contactpersoon.js";
import { contractenRoutes } from "./routes/contracten.js";
import { coverageRoutes } from "./routes/coverage.js";
import { diagnoseRoutes } from "./routes/diagnose.js";
import { documentenRoutes } from "./routes/documenten.js";
import { featureFlagRoutes } from "./routes/feature-flags.js";
import { healthRoutes } from "./routes/health.js";
import { indicatieRoutes } from "./routes/indicaties.js";
import { integratieRoutes } from "./routes/integraties.js";
import { masterAdminRoutes } from "./routes/master-admins.js";
import { mdoRoutes } from "./routes/mdo.js";
import { medewerkerRoutes } from "./routes/medewerkers.js";
import { medicatieOverzichtRoutes } from "./routes/medicatie-overzicht.js";
import { medicatieRoutes } from "./routes/medicatie.js";
import { micMeldingRoutes } from "./routes/mic-melding.js";
import { organisatieRoutes } from "./routes/organisatie.js";
import { productieRoutes } from "./routes/productie.js";
import { rapportageRoutes } from "./routes/rapportage.js";
import { risicoscreeningRoutes } from "./routes/risicoscreening.js";
import { rollenRoutes } from "./routes/rollen.js";
import { roosterRoutes } from "./routes/rooster.js";
import { signaleringRoutes } from "./routes/signaleringen.js";
import { stateMachinesRoutes } from "./routes/state-machines.js";
import { taskFormOptionsRoutes } from "./routes/task-form-options.js";
import { tenantSettingsRoutes } from "./routes/tenant-settings.js";
import { loadTenantFeatures, tenantRoutes } from "./routes/tenants.js";
import { toedieningRoutes } from "./routes/toediening.js";
import { vaccinatieRoutes } from "./routes/vaccinatie.js";
import { validationRulesRoutes } from "./routes/validation-rules.js";
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

// Publieke tenant-features endpoint — MOET voor de /api/* middleware chain
// staan zodat hij niet door tenant/rbac/audit/medplum-auth loopt. Alleen
// X-Tenant-ID vereist; geen Bearer token.
app.get("/api/tenant-features", async (c) => {
  const tenantId = c.req.header("X-Tenant-ID");
  if (!tenantId) {
    return c.json({ error: "X-Tenant-ID header ontbreekt" }, 400);
  }
  const data = await loadTenantFeatures(tenantId);
  return c.json(data);
});

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
app.route("/api/vaccinaties", vaccinatieRoutes);

// Wilsverklaringen / BOPZ-status (Consent)
app.route("/api/clients", wilsverklaringRoutes);
// Cross-client wilsverklaringen overzicht (/api/wilsverklaringen-overzicht)
app.route("/api", wilsverklaringRoutes);

// Medicatieoverzicht (MedicationStatement)
app.route("/api/clients", medicatieOverzichtRoutes);

// MDO / Overleggen (Encounter)
app.route("/api/clients", mdoRoutes);

// Vrijheidsbeperkende maatregelen (Procedure)
app.route("/api/clients", vbmRoutes);
app.route("/api/vbm", vbmRoutes);

// Coverage / Verzekeringsdekking (FHIR Coverage for billing)
app.route("/api/clients", coverageRoutes);

// MIC Meldingen (Incident reports)
app.route("/api/mic-meldingen", micMeldingRoutes);

// Vragenlijsten (Questionnaire + QuestionnaireResponse)
// NB: dubbele mount op /api moet NA alle single-segment /api/* routes
// staan, anders vangt vragenlijsten' /:id catch-all bv /api/medewerkers
// en /api/organisatie op. Zie app.ts onderkant.
app.route("/api/vragenlijsten", vragenlijstenRoutes);

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

// Productieregistratie — delivered care tracking
app.route("/api/productie", productieRoutes);

// Admin: Workflow triggers
app.route("/api/admin/workflow-triggers", workflowTriggerRoutes);
app.route("/api/task-form-options", taskFormOptionsRoutes);
app.route("/api/admin/validation-rules", validationRulesRoutes);
app.route("/api/admin/feature-flags", featureFlagRoutes);
app.route("/api/admin/rollen", rollenRoutes);
app.route("/api/admin/state-machines", stateMachinesRoutes);

// Sprint 6: API docs, Integraties (webhooks + API keys)
app.route("/api/docs", apiDocsRoutes);
app.route("/api/admin/integraties", integratieRoutes);

// Audit log (NEN 7513) — admin viewer
app.route("/api/admin/audit-log", auditLogRoutes);

// AI-instellingen per tenant (enable/disable, Ollama URL, model)
app.route("/api/admin/ai-settings", aiSettingsRoutes);

// AI-assistant (Ollama integration) — data blijft lokaal
app.route("/api/ai", aiRoutes);

// Indicaties (CIZ / Wlz / Zvw / Wmo / Jeugdwet) als FHIR Coverage
app.route("/api", indicatieRoutes);

// Vragenlijsten: dubbele mount op /api voor /clients/:id/responses routes.
// Moet NA alle single-segment /api/* mounts, anders vangt /:id catch-all
// deze bovenliggende routes op.
app.route("/api", vragenlijstenRoutes);

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
