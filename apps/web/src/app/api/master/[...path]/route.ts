import { NextRequest, NextResponse } from "next/server";

/**
 * Dedicated proxy for master admin API calls.
 * Injects the X-Master-Key header server-side so it never leaves the server.
 *
 * Browser calls /api/master/tenants → this proxy → ECD at /api/master/tenants
 */

const ECD_URL = process.env.ECD_SERVICE_URL || "http://localhost:4001";
const MASTER_KEY = process.env.MASTER_ADMIN_KEY || "dev-master-key";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}

async function proxy(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  const path = params.path.join("/");
  const url = `${ECD_URL}/api/master/${path}${req.nextUrl.search}`;

  const forwardHeaders: Record<string, string> = {
    "X-Master-Key": MASTER_KEY,
    "Content-Type": "application/json",
  };

  // Forward auth headers from browser if present
  const auth = req.headers.get("authorization");
  if (auth) forwardHeaders["Authorization"] = auth;

  try {
    const body = req.method !== "GET" && req.method !== "HEAD"
      ? await req.arrayBuffer()
      : undefined;

    const response = await fetch(url, {
      method: req.method,
      headers: forwardHeaders,
      body: body ?? undefined,
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => responseHeaders.set(key, value));

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Kan geen verbinding maken met de ECD service" },
      { status: 502 },
    );
  }
}
