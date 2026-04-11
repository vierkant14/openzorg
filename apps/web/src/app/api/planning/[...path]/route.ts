import { NextRequest, NextResponse } from "next/server";

const PLANNING_URL = process.env.PLANNING_SERVICE_URL || "http://localhost:4002";

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
  const url = `${PLANNING_URL}/${path}${req.nextUrl.search}`;
  const forwardHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => { if (key !== "host") forwardHeaders[key] = value; });
  try {
    const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;
    const response = await fetch(url, { method: req.method, headers: forwardHeaders, body: body ?? undefined });
    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => responseHeaders.set(key, value));
    return new NextResponse(responseBody, { status: response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Kan geen verbinding maken met de Planning service" }, { status: 502 });
  }
}
