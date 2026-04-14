-- OpenZorg PostgreSQL initialization
-- Creates the required databases and schemas for local development.

-- Medplum uses its own database
CREATE DATABASE medplum;

-- Flowable schema (sprint 3, prepared now)
-- Flowable will use the openzorg database with its own schema
CREATE SCHEMA IF NOT EXISTS flowable;

-- OpenZorg tenant configuration schema
CREATE SCHEMA IF NOT EXISTS openzorg;

-- Tenant table with RLS
CREATE TABLE openzorg.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    medplum_project_id TEXT NOT NULL UNIQUE,
    enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['clientregistratie', 'medewerkers', 'organisatie', 'rapportage', 'planning', 'configuratie', 'toegangsbeheer', 'berichten'],
    sector TEXT NOT NULL DEFAULT 'vvt',
    sectors TEXT[] NOT NULL DEFAULT ARRAY['vvt'],
    contact_email TEXT,
    contact_name TEXT,
    settings JSONB NOT NULL DEFAULT '{"bsnRequired": false, "clientnummerPrefix": "C"}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant configuration table (three-layer model, layer 2 data)
CREATE TABLE openzorg.tenant_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    config_type TEXT NOT NULL, -- 'custom_field', 'validation_rule', 'workflow', etc.
    config_data JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Master admin table (multi-user super admin support)
CREATE TABLE IF NOT EXISTS openzorg.master_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES openzorg.master_admins(id)
);

-- Seed master admins
INSERT INTO openzorg.master_admins (email, name) VALUES ('admin@openzorg.nl', 'Super Admin') ON CONFLICT DO NOTHING;
INSERT INTO openzorg.master_admins (email, name) VALUES ('kevin@openzorg.nl', 'Kevin') ON CONFLICT DO NOTHING;
INSERT INTO openzorg.master_admins (email, name) VALUES ('meneka@openzorg.nl', 'Meneka') ON CONFLICT DO NOTHING;

-- Enable Row-Level Security on tenant-scoped tables
ALTER TABLE openzorg.tenant_configurations ENABLE ROW LEVEL SECURITY;

-- RLS policy: tenants can only see their own configurations
-- The tenant_id is set via a session variable: SET openzorg.current_tenant_id = '...'
CREATE POLICY tenant_isolation_policy ON openzorg.tenant_configurations
    USING (tenant_id::text = current_setting('openzorg.current_tenant_id', true));

-- Insert two test tenants for Sprint 1
INSERT INTO openzorg.tenants (id, name, slug, medplum_project_id, enabled_modules, sector, sectors, settings, contact_email, contact_name, status)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Zorggroep Horizon', 'zorggroep-horizon', 'medplum-project-horizon',
     ARRAY['clientregistratie', 'medewerkers', 'organisatie', 'rapportage', 'planning', 'configuratie', 'toegangsbeheer', 'berichten', 'zorgplan', 'mic-meldingen', 'medicatie'],
     'vvt', ARRAY['vvt'], '{"bsnRequired": false, "clientnummerPrefix": "C"}', 'admin@zorggroephorizon.nl', 'Jan de Vries', 'active'),
    ('b0000000-0000-0000-0000-000000000002', 'Thuiszorg De Linde', 'thuiszorg-de-linde', 'medplum-project-linde',
     ARRAY['clientregistratie', 'medewerkers', 'organisatie', 'rapportage', 'planning', 'configuratie', 'toegangsbeheer', 'berichten'],
     'vvt', ARRAY['vvt'], '{"bsnRequired": true, "clientnummerPrefix": "L"}', 'info@thuiszorgdelinde.nl', 'Maria Jansen', 'active');

-- Insert test configurations for tenant A
INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'custom_field', '{"resourceType": "Patient", "fieldName": "voorkeurstaal", "fieldType": "string", "required": false}'),
    ('a0000000-0000-0000-0000-000000000001', 'validation_rule', '{"resourceType": "Patient", "fieldPath": "birthDate", "operator": "required", "value": true, "errorMessage": "Geboortedatum is verplicht"}');

-- Insert test configuration for tenant B
INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data)
VALUES
    ('b0000000-0000-0000-0000-000000000002', 'custom_field', '{"resourceType": "Patient", "fieldName": "huisdier", "fieldType": "string", "required": false}');

-- Webhook registrations per tenant
CREATE TABLE openzorg.webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['*'],
    secret TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys per tenant (for external integrations)
CREATE TABLE openzorg.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['clients:read'],
    active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log table (NEN 7513)
CREATE TABLE openzorg.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'read', 'create', 'update', 'delete'
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB
);

ALTER TABLE openzorg.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_tenant_isolation ON openzorg.audit_log
    USING (tenant_id::text = current_setting('openzorg.current_tenant_id', true));

-- Index for audit log queries
CREATE INDEX idx_audit_log_tenant_timestamp ON openzorg.audit_log (tenant_id, timestamp DESC);
CREATE INDEX idx_audit_log_resource ON openzorg.audit_log (tenant_id, resource_type, resource_id);

-- Facturatie: Prestaties (billable care activities)
CREATE TABLE openzorg.prestaties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    client_id TEXT NOT NULL,
    medewerker_id TEXT,
    datum DATE NOT NULL,
    product_code TEXT NOT NULL,
    product_naam TEXT NOT NULL,
    financieringstype TEXT NOT NULL, -- wlz, wmo, zvw, jeugdwet
    eenheid TEXT NOT NULL DEFAULT 'dag',
    aantal NUMERIC(10,2) NOT NULL DEFAULT 1,
    tarief INTEGER NOT NULL, -- in cents
    totaal INTEGER NOT NULL, -- in cents
    status TEXT NOT NULL DEFAULT 'concept', -- concept, gevalideerd, gedeclareerd
    declaratie_id UUID,
    opmerking TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE openzorg.prestaties ENABLE ROW LEVEL SECURITY;
CREATE POLICY prestatie_tenant_isolation ON openzorg.prestaties
    USING (tenant_id::text = current_setting('openzorg.current_tenant_id', true));
CREATE INDEX idx_prestaties_tenant_status ON openzorg.prestaties (tenant_id, status);
CREATE INDEX idx_prestaties_tenant_client ON openzorg.prestaties (tenant_id, client_id);

-- Facturatie: Declaraties (billing submissions)
CREATE TABLE openzorg.declaraties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    nummer TEXT NOT NULL,
    financieringstype TEXT NOT NULL,
    periode_van DATE NOT NULL,
    periode_tot DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'concept', -- concept, ingediend, geaccepteerd, afgewezen, gecrediteerd, betaald
    totaal_bedrag INTEGER NOT NULL DEFAULT 0, -- in cents
    aantal_prestaties INTEGER NOT NULL DEFAULT 0,
    afwijzings_reden TEXT,
    ingediend_op TIMESTAMPTZ,
    antwoord_op TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE openzorg.declaraties ENABLE ROW LEVEL SECURITY;
CREATE POLICY declaratie_tenant_isolation ON openzorg.declaraties
    USING (tenant_id::text = current_setting('openzorg.current_tenant_id', true));
CREATE INDEX idx_declaraties_tenant_status ON openzorg.declaraties (tenant_id, status);

-- Productieregistratie (delivered care per client per day)
CREATE TABLE openzorg.productie_registratie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_naam TEXT,
    medewerker_id TEXT,
    medewerker_naam TEXT,
    datum DATE NOT NULL,
    uren NUMERIC(5,2) NOT NULL,
    productie_type TEXT NOT NULL, -- 'persoonlijke-verzorging', 'verpleging', 'begeleiding', etc.
    locatie TEXT,
    notitie TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_productie_tenant_datum ON openzorg.productie_registratie (tenant_id, datum DESC);
CREATE INDEX idx_productie_tenant_client ON openzorg.productie_registratie (tenant_id, client_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Plan 2E: Dynamische rollen per tenant
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS openzorg.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES openzorg.tenants(id),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON openzorg.roles(tenant_id) WHERE active = true;

-- Seed default rollen voor alle bestaande tenants (is_system = de 4 bestaande,
-- niet-system = de 4 nieuwe die bewerkbaar blijven).
-- NOTE: permissions-arrays blijven leeg — shared-domain blijft de canonical
-- permission-per-role matrix voor de 4 kern-rollen.
INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'beheerder', 'Beheerder',
       'Functioneel beheerder: beheert processen, formulieren, validatieregels en gebruikers',
       true
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'beheerder');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'zorgmedewerker', 'Zorgmedewerker',
       'Wijkverpleegkundige of verzorgende: raadpleegt dossiers, rapporteert, bekijkt planning',
       true
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'zorgmedewerker');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'planner', 'Planner',
       'Maakt roosters, beheert beschikbaarheid, plant afspraken',
       true
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'planner');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'teamleider', 'Teamleider',
       'Monitort caseload, bekijkt kwaliteitsindicatoren, handelt escalaties af',
       true
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'teamleider');

-- Extra rollen voor VVT-compleetheid (niet-system, kunnen worden gewijzigd)
INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'controller', 'Controller',
       'Financiele controle, facturatie en declaratie-overzicht',
       false
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'controller');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'kwaliteitsmedewerker', 'Kwaliteitsmedewerker',
       'Bewaakt kwaliteit van zorg, HKZ-indicatoren, MIC-analyse',
       false
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'kwaliteitsmedewerker');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'zorgadministratie', 'Zorgadministratie',
       'Administratieve verwerking van indicaties, toewijzingen en declaraties',
       false
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'zorgadministratie');

INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, is_system)
SELECT t.id, 'mic-coordinator', 'MIC-coordinator',
       'Coordineert MIC-meldingen en bewaakt de opvolging',
       false
  FROM openzorg.tenants t
 WHERE NOT EXISTS (SELECT 1 FROM openzorg.roles r WHERE r.tenant_id = t.id AND r.slug = 'mic-coordinator');

-- ──────────────────────────────────────────────────────────────────────────
-- Plan 2C: Platform-level settings per tenant (feature flags, sessie, branding)
-- ──────────────────────────────────────────────────────────────────────────
-- platform_settings JSONB schema:
-- {
--   "featureFlags": {
--     "<slug>": { "enabled": bool, "rolloutDate": "YYYY-MM-DD"?, "notes": string? }
--   },
--   "session": {
--     "accessTokenLifetime": string (ISO duration),
--     "refreshTokenLifetime": string,
--     "idleTimeoutMinutes": number
--   },
--   "branding": {
--     "logoUrl": string,
--     "primaryColor": string (hex),
--     "organizationNameOverride": string
--   }
-- }
ALTER TABLE openzorg.tenants
  ADD COLUMN IF NOT EXISTS platform_settings JSONB NOT NULL DEFAULT jsonb_build_object(
    'featureFlags', jsonb_build_object(
      'workflow-engine',    jsonb_build_object('enabled', true),
      'bpmn-canvas',        jsonb_build_object('enabled', true),
      'dmn-editor',         jsonb_build_object('enabled', false, 'notes', 'Nog niet geïmplementeerd'),
      'facturatie-module',  jsonb_build_object('enabled', true),
      'planning-module',    jsonb_build_object('enabled', true),
      'mic-meldingen',      jsonb_build_object('enabled', true),
      'rapportages-ai',     jsonb_build_object('enabled', false, 'notes', 'Experimenteel'),
      'sales-canvas',       jsonb_build_object('enabled', false, 'notes', 'Alleen voor demo tenants')
    ),
    'session', jsonb_build_object(
      'accessTokenLifetime', '1d',
      'refreshTokenLifetime', '30d',
      'idleTimeoutMinutes', 60
    ),
    'branding', jsonb_build_object(
      'logoUrl', '',
      'primaryColor', '',
      'organizationNameOverride', ''
    )
  );

-- Backfill voor bestaande rijen (IF NOT EXISTS boven voegt alleen de kolom toe,
-- default geldt alleen voor nieuwe rijen; bestaande krijgen {})
UPDATE openzorg.tenants
   SET platform_settings = jsonb_build_object(
     'featureFlags', jsonb_build_object(
       'workflow-engine',    jsonb_build_object('enabled', true),
       'bpmn-canvas',        jsonb_build_object('enabled', true),
       'dmn-editor',         jsonb_build_object('enabled', false),
       'facturatie-module',  jsonb_build_object('enabled', true),
       'planning-module',    jsonb_build_object('enabled', true),
       'mic-meldingen',      jsonb_build_object('enabled', true),
       'rapportages-ai',     jsonb_build_object('enabled', false),
       'sales-canvas',       jsonb_build_object('enabled', false)
     ),
     'session', jsonb_build_object(
       'accessTokenLifetime', '1d',
       'refreshTokenLifetime', '30d',
       'idleTimeoutMinutes', 60
     ),
     'branding', jsonb_build_object(
       'logoUrl', '',
       'primaryColor', '',
       'organizationNameOverride', ''
     )
   )
 WHERE platform_settings = '{}'::jsonb OR platform_settings IS NULL;
