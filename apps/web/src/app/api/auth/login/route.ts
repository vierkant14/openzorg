import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication endpoint that proxies to Medplum Auth.
 * In production, this communicates with the self-hosted Medplum instance.
 * For Sprint 1, this provides the interface that will be wired up to Medplum.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body as { email: string; password: string };

  if (!email || !password) {
    return NextResponse.json({ message: "E-mailadres en wachtwoord zijn verplicht" }, { status: 400 });
  }

  const medplumBaseUrl = process.env.MEDPLUM_BASE_URL || "http://localhost:8103";

  try {
    const authResponse = await fetch(`${medplumBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        clientId: process.env.MEDPLUM_CLIENT_ID,
        projectId: process.env.MEDPLUM_PROJECT_ID,
      }),
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { message: "Ongeldige inloggegevens" },
        { status: 401 },
      );
    }

    const data = await authResponse.json();

    const response = NextResponse.json({ success: true });
    response.cookies.set("medplum_token", data.accessToken || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours as per security requirements
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Kan geen verbinding maken met de authenticatieserver" },
      { status: 502 },
    );
  }
}
