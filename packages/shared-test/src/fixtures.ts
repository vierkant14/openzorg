import type { Tenant } from "@openzorg/shared-domain";

/**
 * Test fixtures for OpenZorg.
 * These provide consistent test data across all packages and services.
 */

export const TEST_TENANT_A: Tenant = {
  id: "tenant-a-id",
  name: "Zorggroep Horizon",
  slug: "zorggroep-horizon",
  medplumProjectId: "medplum-project-a",
  enabledModules: ["ecd", "planning"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

export const TEST_TENANT_B: Tenant = {
  id: "tenant-b-id",
  name: "Thuiszorg De Linde",
  slug: "thuiszorg-de-linde",
  medplumProjectId: "medplum-project-b",
  enabledModules: ["ecd"],
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
};

export const TEST_FHIR_PATIENT = {
  resourceType: "Patient" as const,
  id: "test-patient-1",
  identifier: [
    {
      system: "http://fhir.nl/fhir/NamingSystem/bsn",
      value: "123456782",
    },
  ],
  name: [
    {
      family: "De Vries",
      given: ["Jan"],
    },
  ],
  birthDate: "1955-03-15",
};
