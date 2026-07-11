/**
 * Timer Service — signaleert naderende zorgplan-evaluaties en start het
 * bijbehorende zorgpad (zorgplan-evaluatie) via de workflow-bridge.
 *
 * Draait op een interval (default: elke 6 uur). W1-5 repareerde drie bugs:
 *  1. De bridge-call miste de X-Tenant-ID-header → altijd 400. De tenant
 *     wordt nu per CarePlan afgeleid uit meta.project (elke Medplum-resource
 *     draagt zijn project) en het super-admin-token mag namens élke tenant
 *     starten (auth-middleware W1-1).
 *  2. Variabelen werden als array door Object.entries gehaald → keys "0","1".
 *     De bridge verwacht een Record en mapt zelf.
 *  3. Geen idempotentie → elke run startte een duplicaatproces. Na een
 *     succesvolle start stempelt de service de CarePlan-extensie
 *     `evaluatie-gesignaleerd-op` met de evaluatiedatum en slaat gelijke
 *     datums voortaan over.
 *
 * Herindicatie-signalering is bewust verwijderd (timebox-besluit W1-plan
 * Task 13): Patient-extensies zijn zonder eigen SearchParameter niet
 * doorzoekbaar, dus dit vergt een eigen build — roadmap, zie
 * overdrachtsrapport. De herindicatie-BPMN-template blijft handmatig
 * startbaar via de Processen-hub.
 */

const WORKFLOW_BRIDGE_URL =
  process.env.WORKFLOW_BRIDGE_URL || "http://workflow-bridge:4003";

const MEDPLUM_URL = process.env.MEDPLUM_BASE_URL || "http://medplum:8103";

/** Check interval in milliseconds (default: 6 hours) */
const CHECK_INTERVAL_MS = Number(process.env.TIMER_INTERVAL_MS) || 6 * 60 * 60 * 1000;

/** How many days before a deadline to fire the signalering */
const EVALUATIE_WARNING_DAYS = 28; // 4 weeks

const EVALUATIE_DATUM_URL = "https://openzorg.nl/extensions/volgende-evaluatie-datum";
const GESIGNALEERD_URL = "https://openzorg.nl/extensions/evaluatie-gesignaleerd-op";

interface TimerCheckResult {
  evaluatiesGesignaleerd: number;
  overgeslagen: number;
}

interface FhirExtension {
  url: string;
  valueDate?: string;
}

interface CarePlanResource {
  resourceType: "CarePlan";
  id?: string;
  meta?: { project?: string };
  subject?: { reference?: string };
  extension?: FhirExtension[];
  [key: string]: unknown;
}

/**
 * Start the timer service. Call once at application startup.
 * Returns a cleanup function to stop the interval.
 */
export function startTimerService(): () => void {
  // Don't start in test environment
  if (process.env.NODE_ENV === "test") return () => {};

  console.warn("[timer-service] Started. Check interval:", CHECK_INTERVAL_MS / 1000 / 60, "minutes");

  // Run first check after 30 seconds (let services start up)
  const initialTimeout = setTimeout(() => {
    runTimerCheck().catch((err) => {
      console.error("[timer-service] Initial check failed:", err);
    });
  }, 30_000);

  const interval = setInterval(() => {
    runTimerCheck().catch((err) => {
      console.error("[timer-service] Periodic check failed:", err);
    });
  }, CHECK_INTERVAL_MS);

  return () => {
    clearTimeout(initialTimeout);
    clearInterval(interval);
  };
}

/** Exported voor tests. */
export async function runTimerCheck(): Promise<TimerCheckResult> {
  const result: TimerCheckResult = { evaluatiesGesignaleerd: 0, overgeslagen: 0 };

  try {
    // Systeembrede check — vereist een super-admin-token (mag namens elke tenant).
    const token = process.env.MEDPLUM_SUPER_ADMIN_TOKEN;
    if (!token) {
      // No token available — skip timer check silently
      return result;
    }

    const today = new Date();
    const evalWarningDate = new Date(today);
    evalWarningDate.setDate(evalWarningDate.getDate() + EVALUATIE_WARNING_DAYS);

    const cpRes = await fetch(
      `${MEDPLUM_URL}/fhir/R4/CarePlan?status=active&_count=200`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/fhir+json" } },
    );

    if (!cpRes.ok) {
      console.error("[timer-service] CarePlan-query faalde:", cpRes.status);
      return result;
    }

    const bundle = (await cpRes.json()) as { entry?: Array<{ resource: CarePlanResource }> };

    for (const entry of bundle.entry ?? []) {
      const careplan = entry.resource;
      const evalDateStr = careplan.extension?.find((e) => e.url === EVALUATIE_DATUM_URL)?.valueDate;
      if (!evalDateStr) continue;

      const evalDate = new Date(evalDateStr);
      if (!(evalDate <= evalWarningDate && evalDate >= today)) continue;

      // Idempotentie: al gesignaleerd voor déze evaluatiedatum → overslaan
      const gesignaleerdOp = careplan.extension?.find((e) => e.url === GESIGNALEERD_URL)?.valueDate;
      if (gesignaleerdOp === evalDateStr) {
        result.overgeslagen++;
        continue;
      }

      // Tenant van deze CarePlan: elke Medplum-resource draagt zijn project
      const tenantId = careplan.meta?.project;
      if (!tenantId) {
        console.warn(`[timer-service] CarePlan ${careplan.id} zonder meta.project — overgeslagen`);
        continue;
      }

      const gestart = await startProces(
        "zorgplan-evaluatie",
        {
          zorgplanId: careplan.id ?? "",
          clientRef: careplan.subject?.reference ?? "",
          signaleringType: "evaluatie-herinnering",
        },
        tenantId,
        token,
      );

      if (gestart) {
        await stempelGesignaleerd(careplan, evalDateStr, token);
        result.evaluatiesGesignaleerd++;
      }
    }

    console.warn(
      `[timer-service] Check complete: ${result.evaluatiesGesignaleerd} evaluaties gestart, ${result.overgeslagen} al gesignaleerd`,
    );
  } catch (err) {
    console.error("[timer-service] Error during check:", err);
  }

  return result;
}

async function startProces(
  processKey: string,
  variables: Record<string, string>,
  tenantId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${WORKFLOW_BRIDGE_URL}/api/processen/${processKey}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenantId,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ variables }),
    });
    if (!res.ok) {
      console.error(`[timer-service] Start ${processKey} voor tenant ${tenantId} faalde:`, res.status);
    }
    return res.ok;
  } catch (err) {
    console.error(`[timer-service] Start ${processKey} onbereikbaar:`, err);
    return false;
  }
}

/** Stempelt de CarePlan met de gesignaleerde evaluatiedatum (idempotentie-marker). */
async function stempelGesignaleerd(
  careplan: CarePlanResource,
  evalDateStr: string,
  token: string,
): Promise<void> {
  try {
    const extensies = (careplan.extension ?? []).filter((e) => e.url !== GESIGNALEERD_URL);
    extensies.push({ url: GESIGNALEERD_URL, valueDate: evalDateStr });

    await fetch(`${MEDPLUM_URL}/fhir/R4/CarePlan/${careplan.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/fhir+json" },
      body: JSON.stringify({ ...careplan, extension: extensies }),
    });
  } catch (err) {
    // Marker-fout is niet fataal; volgende run probeert opnieuw (start is dan dubbel —
    // gelogd zodat het opvalt)
    console.error("[timer-service] Kon gesignaleerd-marker niet zetten:", err);
  }
}
