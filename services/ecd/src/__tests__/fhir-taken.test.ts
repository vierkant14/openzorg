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
  "X-User-Id": "prac-9",
  "Content-Type": "application/json",
};

describe("FHIR-taken — claim en complete (werkbak-bron 2)", () => {
  it("claim zet owner en status accepted", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ resourceType: "Task", id: "t1", status: "requested" }))
      .mockResolvedValueOnce(
        jsonResponse({ resourceType: "Task", id: "t1", status: "accepted" }),
      );

    const res = await app.request("/api/fhir-taken/t1/claim", {
      method: "POST",
      headers: HEADERS,
    });

    expect(res.status).toBe(200);
    const putCall = mockFetch.mock.calls[1];
    expect(putCall?.[1]?.method).toBe("PUT");
    const verzonden = JSON.parse(String(putCall?.[1]?.body)) as {
      status: string;
      owner: { reference: string };
    };
    expect(verzonden.status).toBe("accepted");
    expect(verzonden.owner.reference).toBe("Practitioner/prac-9");
  });

  it("claim van een taak van een collega → 409", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resourceType: "Task",
        id: "t1",
        status: "accepted",
        owner: { reference: "Practitioner/iemand-anders" },
      }),
    );

    const res = await app.request("/api/fhir-taken/t1/claim", {
      method: "POST",
      headers: HEADERS,
    });

    expect(res.status).toBe(409);
    expect(mockFetch).toHaveBeenCalledTimes(1); // geen PUT
  });

  it("complete zet status completed en bewaart de opmerking", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ resourceType: "Task", id: "t1", status: "accepted" }))
      .mockResolvedValueOnce(
        jsonResponse({ resourceType: "Task", id: "t1", status: "completed" }),
      );

    const res = await app.request("/api/fhir-taken/t1/complete", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ opmerking: "Evaluatie afgerond met cliënt" }),
    });

    expect(res.status).toBe(200);
    const verzonden = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body)) as {
      status: string;
      note: Array<{ text: string }>;
    };
    expect(verzonden.status).toBe("completed");
    expect(verzonden.note[0]?.text).toBe("Evaluatie afgerond met cliënt");
  });

  it("zonder X-User-Id → 400", async () => {
    const res = await app.request("/api/fhir-taken/t1/claim", {
      method: "POST",
      headers: { "X-Tenant-ID": "test-tenant" },
    });
    expect(res.status).toBe(400);
  });
});
