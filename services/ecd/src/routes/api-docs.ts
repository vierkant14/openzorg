import { Hono } from "hono";

import type { AppEnv } from "../app.js";

export const apiDocsRoutes = new Hono<AppEnv>();

/**
 * GET /api/docs — OpenAPI 3.0 specification for the ECD service.
 * Auto-generated from route definitions.
 */
apiDocsRoutes.get("/", (c) => {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "OpenZorg ECD API",
      description: "REST API voor het Elektronisch Cliëntendossier van OpenZorg. Alle endpoints vereisen X-Tenant-ID en Authorization headers.",
      version: "1.0.0",
      contact: { name: "OpenZorg", url: "https://github.com/vierkant14/openzorg" },
      license: { name: "Apache 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
    },
    servers: [
      { url: "http://localhost:4001", description: "Lokale ontwikkelomgeving" },
    ],
    security: [{ bearerAuth: [] }, { tenantId: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Medplum access token" },
        tenantId: { type: "apiKey", in: "header", name: "X-Tenant-ID", description: "Medplum Project ID van de tenant" },
        userRole: { type: "apiKey", in: "header", name: "X-User-Role", description: "Rol van de gebruiker (beheerder/zorgmedewerker/planner/teamleider)" },
        masterKey: { type: "apiKey", in: "header", name: "X-Master-Key", description: "Master admin API sleutel" },
      },
    },
    paths: {
      "/api/clients": {
        get: { summary: "Clientenlijst", tags: ["Clienten"], description: "Alle Patient resources ophalen", responses: { "200": { description: "FHIR Bundle met Patient resources" } } },
        post: { summary: "Client aanmaken", tags: ["Clienten"], description: "Nieuwe Patient aanmaken. BSN wordt gevalideerd (elfproef). Clientnummer wordt automatisch gegenereerd.", responses: { "201": { description: "Aangemaakte Patient" }, "400": { description: "Validatiefout (bijv. ongeldige BSN)" } } },
      },
      "/api/clients/{id}": {
        get: { summary: "Client ophalen", tags: ["Clienten"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Patient resource" } } },
        put: { summary: "Client bijwerken", tags: ["Clienten"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Bijgewerkte Patient" } } },
        delete: { summary: "Client inactief maken", tags: ["Clienten"], description: "Soft delete: zet Patient.active op false", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Gedeactiveerde Patient" } } },
      },
      "/api/clients/{patientId}/zorgplan": {
        get: { summary: "Zorgplan ophalen", tags: ["Zorgplan"], parameters: [{ name: "patientId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "CarePlan + Goals + ServiceRequests" } } },
        post: { summary: "Zorgplan aanmaken", tags: ["Zorgplan"], responses: { "201": { description: "Aangemaakt CarePlan" } } },
      },
      "/api/clients/{patientId}/rapportages": {
        get: { summary: "Rapportages ophalen", tags: ["Rapportage"], responses: { "200": { description: "FHIR Bundle met Observation resources (SOEP)" } } },
        post: { summary: "Rapportage aanmaken", tags: ["Rapportage"], description: "SOEP-rapportage of vrije notitie. Componenten: subjectief, objectief, evaluatie, plan.", responses: { "201": { description: "Aangemaakte Observation" } } },
      },
      "/api/clients/{patientId}/medicatie": {
        get: { summary: "Medicatieoverzicht", tags: ["Medicatie"], responses: { "200": { description: "FHIR Bundle met MedicationRequest resources" } } },
        post: { summary: "Medicatie toevoegen", tags: ["Medicatie"], responses: { "201": { description: "Aangemaakte MedicationRequest" } } },
      },
      "/api/clients/{patientId}/allergieen": {
        get: { summary: "Allergieën ophalen", tags: ["Allergieën"], responses: { "200": { description: "FHIR Bundle met AllergyIntolerance resources" } } },
        post: { summary: "Allergie registreren", tags: ["Allergieën"], responses: { "201": { description: "Aangemaakte AllergyIntolerance" } } },
      },
      "/api/clients/{patientId}/diagnoses": {
        get: { summary: "Diagnoses ophalen", tags: ["Diagnoses"], responses: { "200": { description: "FHIR Bundle met Condition resources" } } },
        post: { summary: "Diagnose registreren", tags: ["Diagnoses"], responses: { "201": { description: "Aangemaakte Condition" } } },
      },
      "/api/clients/{patientId}/risicoscreenings": {
        get: { summary: "Risicoscreenings ophalen", tags: ["Screenings"], responses: { "200": { description: "FHIR Bundle met RiskAssessment resources" } } },
        post: { summary: "Screening uitvoeren", tags: ["Screenings"], responses: { "201": { description: "Aangemaakt RiskAssessment" } } },
      },
      "/api/clients/{patientId}/contactpersonen": {
        get: { summary: "Contactpersonen ophalen", tags: ["Contactpersonen"], responses: { "200": { description: "FHIR Bundle met RelatedPerson resources" } } },
        post: { summary: "Contactpersoon toevoegen", tags: ["Contactpersonen"], responses: { "201": { description: "Aangemaakte RelatedPerson" } } },
      },
      "/api/clients/{patientId}/documenten": {
        get: { summary: "Documenten ophalen", tags: ["Documenten"], responses: { "200": { description: "FHIR Bundle met DocumentReference resources" } } },
        post: { summary: "Document uploaden", tags: ["Documenten"], description: "Multipart form upload. Bestand wordt opgeslagen als FHIR Binary.", responses: { "201": { description: "Aangemaakte DocumentReference" } } },
      },
      "/api/medewerkers": {
        get: { summary: "Medewerkers ophalen", tags: ["Medewerkers"], responses: { "200": { description: "FHIR Bundle met Practitioner resources" } } },
        post: { summary: "Medewerker aanmaken", tags: ["Medewerkers"], description: "AGB-code wordt gevalideerd (8 cijfers).", responses: { "201": { description: "Aangemaakte Practitioner" } } },
      },
      "/api/organisatie": {
        get: { summary: "Organisatiestructuur", tags: ["Organisatie"], responses: { "200": { description: "FHIR Bundle met Organization resources (boomstructuur via partOf)" } } },
        post: { summary: "Locatie toevoegen", tags: ["Organisatie"], responses: { "201": { description: "Aangemaakte Organization" } } },
      },
      "/api/berichten": {
        get: { summary: "Berichten ophalen", tags: ["Berichten"], responses: { "200": { description: "FHIR Bundle met Communication resources" } } },
        post: { summary: "Bericht versturen", tags: ["Berichten"], responses: { "201": { description: "Aangemaakte Communication" } } },
      },
      "/api/mic-meldingen": {
        get: { summary: "MIC-meldingen ophalen", tags: ["MIC"], responses: { "200": { description: "Incidentmeldingen" } } },
        post: { summary: "MIC-melding aanmaken", tags: ["MIC"], responses: { "201": { description: "Aangemaakte melding" } } },
      },
      "/api/contracten": {
        get: { summary: "Contracten ophalen", tags: ["Contracten"], responses: { "200": { description: "PractitionerRole resources met contract-extensies" } } },
        post: { summary: "Contract aanmaken", tags: ["Contracten"], responses: { "201": { description: "Aangemaakt contract" } } },
      },
      "/api/rooster/week": {
        get: { summary: "Weekrooster", tags: ["Rooster"], parameters: [{ name: "medewerker", in: "query", required: true, schema: { type: "string" } }, { name: "datum", in: "query", schema: { type: "string", format: "date" } }], responses: { "200": { description: "Diensten voor de week" } } },
      },
      "/api/rooster/dienst": {
        post: { summary: "Dienst plannen", tags: ["Rooster"], responses: { "201": { description: "Geplande dienst (Slot)" } } },
      },
      "/api/capaciteit/overzicht": {
        get: { summary: "Capaciteitsoverzicht", tags: ["Capaciteit"], description: "Dashboard: bedden × clienten × medewerkers × FTE met signalen", responses: { "200": { description: "Capaciteitsdata" } } },
      },
      "/api/admin/codelijsten/{type}": {
        get: { summary: "Codelijst ophalen", tags: ["Codelijsten"], description: "Haal de tenant-specifieke codelijst op (SNOMED-gebaseerd)", responses: { "200": { description: "ValueSet met SNOMED termen" } } },
        post: { summary: "Term toevoegen", tags: ["Codelijsten"], description: "Voeg een SNOMED term toe aan de organisatielijst", responses: { "201": { description: "Bijgewerkte ValueSet" } } },
      },
      "/api/admin/codelijsten/snomed/search": {
        get: { summary: "SNOMED CT zoeken", tags: ["Codelijsten"], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }, { name: "type", in: "query", schema: { type: "string", enum: ["diagnoses", "allergieen", "medicatie", "verrichtingen"] } }], responses: { "200": { description: "SNOMED zoekresultaten" } } },
      },
      "/api/tenant-settings": {
        get: { summary: "Tenant instellingen", tags: ["Configuratie"], description: "Instellingen van de huidige tenant (bsnRequired, modules, sector)", responses: { "200": { description: "Tenant settings" } } },
      },
      "/api/master/tenants": {
        get: { summary: "Alle tenants", tags: ["Master Admin"], security: [{ masterKey: [] }], description: "Lijst van alle zorginstellingen", responses: { "200": { description: "Tenant lijst" } } },
        post: { summary: "Tenant aanmaken", tags: ["Master Admin"], security: [{ masterKey: [] }], description: "Nieuwe zorginstelling onboarden", responses: { "201": { description: "Aangemaakte tenant" } } },
      },
    },
    tags: [
      { name: "Clienten", description: "Patient CRUD en clientbeheer" },
      { name: "Zorgplan", description: "CarePlan, doelen en interventies" },
      { name: "Rapportage", description: "SOEP-rapportages en klinische notities" },
      { name: "Medicatie", description: "Medicatieoverzicht en -beheer" },
      { name: "Allergieën", description: "Allergieën en intoleranties" },
      { name: "Diagnoses", description: "Diagnoses en aandoeningen" },
      { name: "Screenings", description: "Risicoscreenings (val, decubitus, etc.)" },
      { name: "Contactpersonen", description: "Contactpersonen van clienten" },
      { name: "Documenten", description: "Documentupload en -beheer" },
      { name: "Medewerkers", description: "Practitioner registratie en AGB" },
      { name: "Organisatie", description: "Locaties en afdelingen" },
      { name: "Berichten", description: "Intern berichtensysteem" },
      { name: "MIC", description: "Melding Incidenten Client" },
      { name: "Contracten", description: "Medewerkercontracten en FTE" },
      { name: "Rooster", description: "Weekrooster en diensten" },
      { name: "Capaciteit", description: "Bedden, bezettingsgraad, signalen" },
      { name: "Codelijsten", description: "SNOMED-gebaseerde terminologielijsten" },
      { name: "Configuratie", description: "Custom velden en validatieregels" },
      { name: "Master Admin", description: "Platform-breed tenantbeheer" },
    ],
  };

  return c.json(spec);
});
