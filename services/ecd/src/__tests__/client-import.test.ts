import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock database to prevent ECONNREFUSED noise in tests
vi.mock("../lib/db.js", () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  },
}));

import { app } from "../app.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/fhir+json" },
  });
}

const HEADERS = {
  "X-Tenant-ID": "test-tenant",
  "X-User-Role": "beheerder",
  "X-User-Id": "prac-1",
  "Content-Type": "text/csv",
};

/**
 * Fetch-router voor de import-flow:
 *  - Organization-query → locaties
 *  - Patient?identifier=clientnummer → hoogste nummer
 *  - Patient?identifier=bsn → duplicaatcheck (default: geen)
 *  - POST Patient → aanmaken
 */
function routeerFetch(opties?: { bestaandeBsns?: string[]; patientCreateStatus?: number }) {
  const aangemaakt: Array<Record<string, unknown>> = [];
  mockFetch.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/fhir/R4/Organization")) {
      return jsonResponse({
        resourceType: "Bundle",
        entry: [
          { resource: { id: "org-centrum", name: "Horizon Centrum" } },
          { resource: { id: "org-thuis", name: "Thuiszorg Regio Noord" } },
        ],
      });
    }
    if (u.includes("identifier=") && u.includes("clientnummer")) {
      return jsonResponse({ resourceType: "Bundle", entry: [] });
    }
    if (u.includes("identifier=") && u.includes("bsn")) {
      const bestaand = (opties?.bestaandeBsns ?? []).some((bsn) => decodeURIComponent(u).includes(bsn));
      return jsonResponse({
        resourceType: "Bundle",
        entry: bestaand ? [{ resource: { id: "bestaat" } }] : [],
      });
    }
    if (u.endsWith("/fhir/R4/Patient") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      aangemaakt.push(body);
      if (opties?.patientCreateStatus && opties.patientCreateStatus >= 400) {
        return jsonResponse(
          { resourceType: "OperationOutcome", issue: [{ diagnostics: "Serverfout" }] },
          opties.patientCreateStatus,
        );
      }
      return jsonResponse({ resourceType: "Patient", id: `pat-${aangemaakt.length}` }, 201);
    }
    return jsonResponse({}, 200);
  });
  return aangemaakt;
}

const HEADER_REGEL = "achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie";

describe("POST /api/clients/import (CSV, W3-1)", () => {
  it("happy path: 3 rijen worden aangemaakt met clientnummer, adres en locatie", async () => {
    const aangemaakt = routeerFetch();

    const csv = [
      HEADER_REGEL,
      "Jansen;Piet;1948-03-12;123456782;Dorpsstraat;12;1234 AB;Zorgstad;Horizon Centrum",
      "de Vries;Anna;1952-11-30;;Kerkweg;8;5678 CD;Zorgstad;",
      "Bakker;Jan;1940-01-05;;;;;;Thuiszorg Regio Noord",
    ].join("\n");

    const res = await app.request("/api/clients/import", { method: "POST", headers: HEADERS, body: csv });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { totaal: number; aangemaakt: number; fouten: unknown[] };
    expect(body).toMatchObject({ totaal: 3, aangemaakt: 3, fouten: [] });

    expect(aangemaakt).toHaveLength(3);
    const eerste = aangemaakt[0] as {
      identifier: Array<{ system: string; value: string }>;
      address: Array<{ line: string[]; postalCode: string; city: string }>;
      extension: Array<{ url: string }>;
    };
    expect(eerste.identifier).toContainEqual({
      system: "https://openzorg.nl/NamingSystem/clientnummer",
      value: "C-00001",
    });
    expect(eerste.address[0]).toMatchObject({ line: ["Dorpsstraat 12"], postalCode: "1234 AB", city: "Zorgstad" });
    expect(eerste.extension?.[0]?.url).toBe("https://openzorg.nl/extensions/locatie-toewijzing");

    // Nummering loopt door
    const derde = aangemaakt[2] as { identifier: Array<{ value: string }> };
    expect(derde.identifier[0]?.value).toBe("C-00003");
  });

  it("foute BSN → rij in fouten, rest wordt aangemaakt", async () => {
    routeerFetch();
    const csv = [HEADER_REGEL, "Jansen;;1948-03-12;000000000;;;;;", "de Vries;;1952-11-30;;;;;;"].join("\n");

    const res = await app.request("/api/clients/import", { method: "POST", headers: HEADERS, body: csv });
    const body = (await res.json()) as { aangemaakt: number; fouten: Array<{ rij: number; veld?: string }> };

    expect(body.aangemaakt).toBe(1);
    expect(body.fouten).toHaveLength(1);
    expect(body.fouten[0]).toMatchObject({ rij: 2, veld: "bsn" });
  });

  it("onbekende locatie → duidelijke fout per rij", async () => {
    routeerFetch();
    const csv = [HEADER_REGEL, "Jansen;;1948-03-12;;;;;;Bestaat Niet"].join("\n");

    const res = await app.request("/api/clients/import", { method: "POST", headers: HEADERS, body: csv });
    const body = (await res.json()) as { aangemaakt: number; fouten: Array<{ veld?: string; melding: string }> };

    expect(body.aangemaakt).toBe(0);
    expect(body.fouten[0]?.veld).toBe("locatie");
    expect(body.fouten[0]?.melding).toContain("Bestaat Niet");
  });

  it("bestaande BSN in de tenant → rij overgeslagen met melding", async () => {
    routeerFetch({ bestaandeBsns: ["123456782"] });
    const csv = [HEADER_REGEL, "Jansen;;1948-03-12;123456782;;;;;"].join("\n");

    const res = await app.request("/api/clients/import", { method: "POST", headers: HEADERS, body: csv });
    const body = (await res.json()) as { aangemaakt: number; fouten: Array<{ melding: string }> };

    expect(body.aangemaakt).toBe(0);
    expect(body.fouten[0]?.melding).toContain("bestaat al");
  });

  it("ontbrekende verplichte kolom in de header → 400 met formaat-uitleg", async () => {
    const res = await app.request("/api/clients/import", {
      method: "POST",
      headers: HEADERS,
      body: "voornaam;bsn\nPiet;123456782",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issue: Array<{ diagnostics: string }> };
    expect(body.issue[0]?.diagnostics).toContain("achternaam");
  });

  it("komma-CSV met quotes wordt ook geaccepteerd", async () => {
    const aangemaakt = routeerFetch();
    const csv = [
      'achternaam,voornaam,geboortedatum,bsn,straat,huisnummer,postcode,plaats,locatie',
      '"van der Berg, sr.",Willem,1945-06-20,,,,,,',
    ].join("\n");

    const res = await app.request("/api/clients/import", { method: "POST", headers: HEADERS, body: csv });
    const body = (await res.json()) as { aangemaakt: number };
    expect(body.aangemaakt).toBe(1);
    const patient = aangemaakt[0] as { name: Array<{ family: string }> };
    expect(patient.name[0]?.family).toBe("van der Berg, sr.");
  });
});
