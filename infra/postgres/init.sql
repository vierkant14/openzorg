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
