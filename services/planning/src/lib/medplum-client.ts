import type { Context } from "hono";

import type { AppEnv } from "../app.js";

const MEDPLUM_BASE_URL = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

export interface FhirOperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics?: string;
  }>;
}

/**
 * Creates a FHIR OperationOutcome error response.
 */
export function operationOutcome(
  severity: "fatal" | "error" | "warning" | "information",
  code: string,
  diagnostics: string,
): FhirOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, diagnostics }],
  };
}

/**
 * Sends a request to the Medplum FHIR API and returns the parsed JSON response.
 * Forwards the Authorization header from the incoming request.
 */
export async function medplumFetch(
  c: Context<AppEnv>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const authHeader = c.req.header("Authorization") ?? "";

  const url = `${MEDPLUM_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/fhir+json",
    Accept: "application/fhir+json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

/**
 * Proxies a Medplum response back to the client, preserving status codes.
 */
export async function proxyMedplumResponse(
  c: Context<AppEnv>,
  response: Response,
): Promise<Response> {
  const body: unknown = await response.json();

  return c.json(body as Record<string, unknown>, response.status as 200);
}

/**
 * Convenience wrapper: fetch from Medplum and proxy the response.
 */
export async function medplumProxy(
  c: Context<AppEnv>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await medplumFetch(c, path, options);
  return proxyMedplumResponse(c, response);
}
