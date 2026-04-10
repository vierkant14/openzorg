import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication endpoint that proxies to Medplum Auth using PKCE flow.
 * Handles email/password login and returns an httpOnly session cookie.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, projectId } = body as {
    email: string;
    password: string;
    projectId?: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { message: "E-mailadres en wachtwoord zijn verplicht" },
      { status: 400 },
    );
  }

  const medplumBaseUrl = process.env.MEDPLUM_BASE_URL || "http://localhost:8103";

  // Generate PKCE challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  try {
    // Step 1: Login to Medplum
    const loginResponse = await fetch(`${medplumBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        scope: "openid",
        codeChallenge,
        codeChallengeMethod: "S256",
        ...(projectId ? { projectId } : {}),
      }),
    });

    if (!loginResponse.ok) {
      return NextResponse.json({ message: "Ongeldige inloggegevens" }, { status: 401 });
    }

    const loginData = await loginResponse.json();
    let code: string | undefined;

    // Step 2: Handle membership selection if needed
    if (loginData.memberships && loginData.memberships.length > 0) {
      // If projectId specified, find matching membership
      const membership = projectId
        ? loginData.memberships.find(
            (m: { project: { reference: string } }) =>
              m.project?.reference === `Project/${projectId}`,
          )
        : loginData.memberships[0];

      if (!membership) {
        return NextResponse.json({ message: "Geen toegang tot deze organisatie" }, { status: 403 });
      }

      const profileResponse = await fetch(`${medplumBaseUrl}/auth/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: loginData.login,
          profile: membership.profile,
        }),
      });

      if (!profileResponse.ok) {
        return NextResponse.json({ message: "Profiel selectie mislukt" }, { status: 500 });
      }

      const profileData = await profileResponse.json();
      code = profileData.code;
    } else if (loginData.code) {
      code = loginData.code;
    }

    if (!code) {
      return NextResponse.json({ message: "Onverwachte authenticatie-response" }, { status: 500 });
    }

    // Step 3: Exchange code for access token
    const tokenResponse = await fetch(`${medplumBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=authorization_code&code=${code}&code_verifier=${codeVerifier}`,
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ message: "Token uitwisseling mislukt" }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();

    const response = NextResponse.json({ success: true });
    response.cookies.set("medplum_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 hours per security requirements
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
