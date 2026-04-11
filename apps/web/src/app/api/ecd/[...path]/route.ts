import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse proxy: browser calls /api/ecd/** → ECD service at ECD_SERVICE_URL/**
 *
 * This avoids hard-coding localhost:4001 in the browser bundle, which breaks
 * when the user accesses the app from a different device than the server.
 */

const ECD_URL = process.env.ECD_SERVICE_URL || "http://localhost:4001";

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
  const search = req.nextUrl.search;
  const url = `${ECD_URL}/${path}${search}`;

  // Forward all headers except host
  const forwardHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key !== "host") {
      forwardHeaders[key] = value;
    }
  });

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
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

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
