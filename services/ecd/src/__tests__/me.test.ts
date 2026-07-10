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

const HEADERS = { "X-Tenant-ID": "test-tenant", Authorization: "Bearer token-x" };

describe("GET /api/me — identiteitslaag", () => {
  it("geeft practitioner, naam en rol terug bij een Practitioner-profiel met rol-extensie", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          profile: { reference: "Practitioner/prac-1" },
          project: { reference: "Project/proj-1" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          resourceType: "Practitioner",
          id: "prac-1",
          name: [{ given: ["Fatima"], family: "El Idrissi" }],
          extension: [
            { url: "https://openzorg.nl/extensions/rol", valueCode: "zorgmedewerker" },
          ],
        }),
      );

    const res = await app.request("/api/me", { headers: HEADERS });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      practitionerId: "prac-1",
      naam: "Fatima El Idrissi",
      rol: "zorgmedewerker",
      projectId: "proj-1",
    });
  });

  it("geeft rol null bij een Practitioner zonder (geldige) rol-extensie", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          profile: { reference: "Practitioner/prac-2" },
          project: { reference: "Project/proj-1" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          resourceType: "Practitioner",
          id: "prac-2",
          name: [{ text: "Jan de Boer" }],
          extension: [{ url: "https://openzorg.nl/extensions/rol", valueCode: "niet-bestaand" }],
        }),
      );

    const res = await app.request("/api/me", { headers: HEADERS });
    const body = (await res.json()) as { rol: string | null; naam: string | null };
    expect(body.rol).toBeNull();
    expect(body.naam).toBe("Jan de Boer");
  });

  it("geeft null-identiteit bij een niet-Practitioner-profiel (super-admin)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        profile: { reference: "ClientApplication/app-1" },
        project: { reference: "Project/super" },
      }),
    );

    const res = await app.request("/api/me", { headers: HEADERS });
    const body = (await res.json()) as { practitionerId: string | null; projectId: string | null };
    expect(body.practitionerId).toBeNull();
    expect(body.projectId).toBe("super");
  });

  it("geeft 401 door wanneer het token ongeldig is", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    const res = await app.request("/api/me", { headers: HEADERS });
    expect(res.status).toBe(401);
  });
});
