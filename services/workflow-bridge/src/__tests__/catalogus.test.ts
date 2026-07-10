import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import { pool } from "../lib/db.js";
import { CATALOGUS, type CatalogusProces } from "../lib/proces-catalogus.js";
import { _clearAuthCache } from "../middleware/auth.js";

import { stubFetchMetAuth, tenantHeaders } from "./helpers.js";

vi.mock("../lib/db.js", () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  },
}));

const poolQueryMock = vi.mocked(pool.query);

describe("proces-catalogus", () => {
  beforeEach(() => {
    _clearAuthCache();
    vi.clearAllMocks();
    poolQueryMock.mockResolvedValue({ rows: [], rowCount: 0 } as never);
    stubFetchMetAuth({ projectId: "proj-1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bevat de vijf zorgpaden en elke stap heeft minimaal één veld", async () => {
    const res = await app.request("/api/catalogus", { headers: tenantHeaders() });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { processen: CatalogusProces[] };
    expect(body.processen).toHaveLength(5);
    expect(body.processen.map((p) => p.key).sort()).toEqual([
      "herindicatie",
      "intake-proces",
      "mic-afhandeling",
      "vaccinatie-campagne",
      "zorgplan-evaluatie",
    ]);
    for (const proces of body.processen) {
      expect(proces.stappen.length).toBeGreaterThan(0);
      for (const stap of proces.stappen) {
        expect(stap.velden.length).toBeGreaterThan(0);
        expect(stap.rol).toBeTruthy();
      }
    }
  });

  it("tenant-override (Laag 2) wint van Laag 1 per veldnaam", async () => {
    poolQueryMock
      // resolveTenant → tenant gevonden
      .mockResolvedValueOnce({ rows: [{ id: "uuid-1" }], rowCount: 1 } as never)
      // config-data met een override op mic-afhandeling.meldingAnalyseren
      .mockResolvedValueOnce({
        rows: [
          {
            config_data: {
              "mic-afhandeling": {
                meldingAnalyseren: [
                  {
                    name: "ernstNiveau",
                    label: "Ernst",
                    type: "select",
                    options: [
                      { value: "laag", label: "Laag" },
                      { value: "middel", label: "Middel" },
                      { value: "hoog", label: "Hoog" },
                    ],
                  },
                ],
              },
            },
          },
        ],
        rowCount: 1,
      } as never);

    const res = await app.request("/api/catalogus/mic-afhandeling", { headers: tenantHeaders() });

    expect(res.status).toBe(200);
    const proces = (await res.json()) as CatalogusProces;
    const stap = proces.stappen.find((s) => s.taskKey === "meldingAnalyseren");
    const veld = stap?.velden.find((v) => v.name === "ernstNiveau");
    expect(veld?.options).toHaveLength(3);
    // Laag-1-veld "opmerking" blijft naast de override bestaan
    expect(stap?.velden.some((v) => v.name === "opmerking")).toBe(true);
  });

  it("onbekende key → 404", async () => {
    const res = await app.request("/api/catalogus/bestaat-niet", { headers: tenantHeaders() });
    expect(res.status).toBe(404);
  });

  it("catalogus-stappen dekken de userTasks van de BPMN-templates", async () => {
    // Bewaakt de koppeling catalogus ↔ templates: elke userTask-id in de
    // template-XML moet als stap in de catalogus staan, en vice versa.
    const { getTemplateById } = await import("../routes/bpmn-templates.js");
    for (const proces of CATALOGUS) {
      const template = getTemplateById(proces.key);
      expect(template, `template ${proces.key} ontbreekt`).toBeDefined();
      const xml = template!.getBpmn();
      const taskIds = [...xml.matchAll(/<userTask id="([^"]+)"/g)].map((m) => m[1]).sort();
      const stapIds = proces.stappen.map((s) => s.taskKey).sort();
      expect(stapIds, `stappen van ${proces.key}`).toEqual(taskIds);
    }
  });
});
