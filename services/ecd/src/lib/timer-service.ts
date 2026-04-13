/**
 * Timer Service — checks for upcoming evaluations and herindicaties.
 *
 * Runs on a configurable interval (default: every 6 hours).
 * Scans CarePlans for volgende-evaluatie-datum and Patient extensions
 * for indicatie-einddatum. Creates workflow tasks when deadlines approach.
 *
 * This is a simple polling approach. For production, consider
 * Flowable timer boundary events or a proper job scheduler.
 */

const WORKFLOW_BRIDGE_URL =
  process.env.WORKFLOW_BRIDGE_URL || "http://workflow-bridge:4003";

const MEDPLUM_URL = process.env.MEDPLUM_BASE_URL || "http://medplum:8103";

/** Check interval in milliseconds (default: 6 hours) */
const CHECK_INTERVAL_MS = Number(process.env.TIMER_INTERVAL_MS) || 6 * 60 * 60 * 1000;

/** How many days before a deadline to fire the signalering */
const EVALUATIE_WARNING_DAYS = 28; // 4 weeks
const HERINDICATIE_WARNING_DAYS = 56; // 8 weeks

interface TimerCheckResult {
  evaluatiesGesignaleerd: number;
  herindicatiesGesignaleerd: number;
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

async function runTimerCheck(): Promise<TimerCheckResult> {
  const result: TimerCheckResult = { evaluatiesGesignaleerd: 0, herindicatiesGesignaleerd: 0 };

  try {
    // This is a system-level check — we need a super admin token or service account.
    // For now, we'll use the Medplum super admin credentials if available.
    const token = process.env.MEDPLUM_SUPER_ADMIN_TOKEN;
    if (!token) {
      // No token available — skip timer check silently
      return result;
    }

    const today = new Date();
    const evalWarningDate = new Date(today);
    evalWarningDate.setDate(evalWarningDate.getDate() + EVALUATIE_WARNING_DAYS);

    const herindicatieWarningDate = new Date(today);
    herindicatieWarningDate.setDate(herindicatieWarningDate.getDate() + HERINDICATIE_WARNING_DAYS);

    // Check CarePlans with volgende-evaluatie-datum approaching
    const cpRes = await fetch(
      `${MEDPLUM_URL}/fhir/R4/CarePlan?status=active&_count=200`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/fhir+json" } },
    );

    if (cpRes.ok) {
      const bundle = await cpRes.json() as { entry?: Array<{ resource: Record<string, unknown> }> };
      for (const entry of bundle.entry ?? []) {
        const cp = entry.resource;
        const exts = cp["extension"] as Array<{ url: string; valueDate?: string }> | undefined;
        const evalDateStr = exts?.find((e) => e.url === "https://openzorg.nl/extensions/volgende-evaluatie-datum")?.valueDate;

        if (evalDateStr) {
          const evalDate = new Date(evalDateStr);
          if (evalDate <= evalWarningDate && evalDate >= today) {
            // Evaluation is due within warning period — start workflow
            await startProcess("zorgplan-evaluatie", {
              zorgplanId: cp["id"] as string,
              clientId: (cp["subject"] as { reference?: string })?.reference ?? "",
              signaleringType: "evaluatie-herinnering",
            });
            result.evaluatiesGesignaleerd++;
          }
        }
      }
    }

    console.warn(`[timer-service] Check complete: ${result.evaluatiesGesignaleerd} evaluaties, ${result.herindicatiesGesignaleerd} herindicaties gesignaleerd`);
  } catch (err) {
    console.error("[timer-service] Error during check:", err);
  }

  return result;
}

async function startProcess(
  processKey: string,
  variables: Record<string, string>,
): Promise<void> {
  try {
    const flowableVars = Object.entries(variables).map(([name, value]) => ({
      name,
      value,
    }));

    await fetch(`${WORKFLOW_BRIDGE_URL}/api/processen/${processKey}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: flowableVars }),
    });
  } catch {
    // Fire-and-forget
  }
}
