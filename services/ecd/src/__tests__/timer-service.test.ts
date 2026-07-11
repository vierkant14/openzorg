import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runTimerCheck } from "../lib/timer-service.js";

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/fhir+json" },
  });
}

function careplanBundle(careplans: unknown[]): Response {
  return jsonResponse({ resourceType: "Bundle", entry: careplans.map((resource) => ({ resource })) });
}

/** Evaluatiedatum 10 dagen vooruit — binnen het 28-dagen-signaalvenster. */
function datumOverDagen(dagen: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return d.toISOString().slice(0, 10);
}

describe("timer-service (W1-5 reparaties)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("MEDPLUM_SUPER_ADMIN_TOKEN", "super-token");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("start het zorgpad mét tenant-header en Record-variabelen, en stempelt de marker", async () => {
    const evalDatum = datumOverDagen(10);
    mockFetch
      // 1. CarePlan-query
      .mockResolvedValueOnce(
        careplanBundle([
          {
            resourceType: "CarePlan",
            id: "cp-1",
            meta: { project: "proj-1" },
            subject: { reference: "Patient/pat-1" },
            extension: [
              { url: "https://openzorg.nl/extensions/volgende-evaluatie-datum", valueDate: evalDatum },
            ],
          },
        ]),
      )
      // 2. bridge-start
      .mockResolvedValueOnce(jsonResponse({ id: "pi-1" }, 201))
      // 3. marker-PUT
      .mockResolvedValueOnce(jsonResponse({ resourceType: "CarePlan", id: "cp-1" }));

    const result = await runTimerCheck();

    expect(result.evaluatiesGesignaleerd).toBe(1);

    const startCall = mockFetch.mock.calls[1];
    expect(String(startCall?.[0])).toContain("/api/processen/zorgplan-evaluatie/start");
    const startHeaders = startCall?.[1]?.headers as Record<string, string>;
    expect(startHeaders["X-Tenant-ID"]).toBe("proj-1");
    expect(startHeaders["Authorization"]).toBe("Bearer super-token");
    const startBody = JSON.parse(String(startCall?.[1]?.body)) as { variables: Record<string, string> };
    expect(startBody.variables["zorgplanId"]).toBe("cp-1");
    expect(startBody.variables["clientRef"]).toBe("Patient/pat-1");
    expect(startBody.variables["0"]).toBeUndefined(); // geen Object.entries-array-bug meer

    const markerCall = mockFetch.mock.calls[2];
    expect(markerCall?.[1]?.method).toBe("PUT");
    const markerBody = JSON.parse(String(markerCall?.[1]?.body)) as {
      extension: Array<{ url: string; valueDate: string }>;
    };
    expect(markerBody.extension).toContainEqual({
      url: "https://openzorg.nl/extensions/evaluatie-gesignaleerd-op",
      valueDate: evalDatum,
    });
  });

  it("slaat CarePlans over die al voor deze evaluatiedatum gesignaleerd zijn (idempotentie)", async () => {
    const evalDatum = datumOverDagen(10);
    mockFetch.mockResolvedValueOnce(
      careplanBundle([
        {
          resourceType: "CarePlan",
          id: "cp-1",
          meta: { project: "proj-1" },
          extension: [
            { url: "https://openzorg.nl/extensions/volgende-evaluatie-datum", valueDate: evalDatum },
            { url: "https://openzorg.nl/extensions/evaluatie-gesignaleerd-op", valueDate: evalDatum },
          ],
        },
      ]),
    );

    const result = await runTimerCheck();

    expect(result.evaluatiesGesignaleerd).toBe(0);
    expect(result.overgeslagen).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1); // alleen de query, geen start
  });

  it("doet niets zonder super-admin-token", async () => {
    vi.stubEnv("MEDPLUM_SUPER_ADMIN_TOKEN", "");
    const result = await runTimerCheck();
    expect(result.evaluatiesGesignaleerd).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
