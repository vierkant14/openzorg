/**
 * Workflow trigger configuration.
 *
 * Defines which Flowable BPMN processes should be started
 * in response to FHIR resource lifecycle events.
 *
 * Default triggers live here in code. Per-tenant overrides
 * are stored in PostgreSQL (openzorg.tenant_configurations,
 * config_type = 'workflow_trigger').
 */

export type WorkflowTriggerEvent =
  | "resource.created"
  | "resource.updated"
  | "resource.deleted"
  | "timer.cron";

export interface WorkflowTrigger {
  id: string;
  /** Human-readable name */
  name: string;
  /** When to fire */
  event: WorkflowTriggerEvent;
  /** Which FHIR resource type triggers this */
  resourceType?: string;
  /** Optional condition -- simple path comparison evaluated against the resource */
  condition?: string;
  /** Which Flowable process definition key to start */
  processKey: string;
  /** Variables to pass to the process (key = variable name, value = JSONPath from resource) */
  variables: Record<string, string>;
  /** Is this trigger active? */
  enabled: boolean;
}

/**
 * Default triggers shipped with the platform.
 * Tenants can override these via the admin API.
 */
export const DEFAULT_TRIGGERS: WorkflowTrigger[] = [
  {
    id: "intake-bij-nieuwe-client",
    name: "Intake starten bij nieuwe client",
    event: "resource.created",
    resourceType: "Patient",
    processKey: "intake-proces",
    variables: {
      clientId: "$.id",
      clientNaam: "$.name[0].family",
    },
    enabled: true,
  },
  {
    id: "mic-workflow-bij-incident",
    name: "MIC afhandeling bij incident melding",
    event: "resource.created",
    resourceType: "AuditEvent",
    condition: '$.subtype[0].code === "mic-melding"',
    processKey: "mic-afhandeling",
    variables: {
      meldingId: "$.id",
      locatie: "$.source.site",
    },
    enabled: true,
  },
  {
    id: "evaluatie-bij-zorgplan-update",
    name: "Evaluatie starten bij zorgplan wijziging",
    event: "resource.updated",
    resourceType: "CarePlan",
    condition: '$.status === "active"',
    processKey: "zorgplan-evaluatie",
    variables: {
      zorgplanId: "$.id",
      clientId: "$.subject.reference",
    },
    enabled: false,
  },
  {
    id: "evaluatie-signalering-timer",
    name: "Evaluatie herinnering (6-maandelijks)",
    event: "timer.cron",
    processKey: "zorgplan-evaluatie",
    variables: {},
    enabled: true,
  },
  {
    id: "herindicatie-signalering-timer",
    name: "Herindicatie signalering (8 weken voor einddatum)",
    event: "timer.cron",
    processKey: "herindicatie",
    variables: {},
    enabled: true,
  },
];
