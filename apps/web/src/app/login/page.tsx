"use client";

import type { OpenZorgRole } from "@openzorg/shared-domain";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { startRouteVoorGebruiker } from "../../components/werkruimtes";
import { haalMe, setIdentiteit } from "../../lib/api";
import { refreshFeatureFlags } from "../../lib/features";

const ROLES = [
  { value: "tenant-admin", label: "Tenant admin" },
  { value: "beheerder", label: "Functioneel beheerder" },
  { value: "zorgmedewerker", label: "Zorgmedewerker" },
  { value: "planner", label: "Planner" },
  { value: "teamleider", label: "Teamleider" },
] as const;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const tenantHint = searchParams.get("tenant");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("zorgmedewerker");
  const [error, setError] = useState<string | null>(expired ? "Je sessie is verlopen. Log opnieuw in." : null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Inloggen mislukt");
      }

      // Store token and tenant info for ECD API calls
      if (data.accessToken) {
        localStorage.setItem("openzorg_token", data.accessToken);
      }
      if (data.projectId) {
        localStorage.setItem("openzorg_tenant_id", data.projectId);
      }
      if (data.projectName) {
        localStorage.setItem("openzorg_project_name", data.projectName);
      }
      // Store user name — fallback to email prefix if profile.display is missing
      const displayName = data.profile?.display || email.split("@")[0] || "Gebruiker";
      localStorage.setItem("openzorg_user_name", displayName);

      // Identiteitslaag (ME-01): serverrol uit /api/me wint van de demo-
      // rolkeuze in het formulier. Zonder gekoppelde Practitioner-rol vallen
      // we terug op de formulierkeuze en markeren de sessie als demo-modus.
      const me = await haalMe();
      let effectieveRol: OpenZorgRole;
      if (me?.rol) {
        setIdentiteit(me);
        effectieveRol = me.rol as OpenZorgRole;
      } else {
        if (me) setIdentiteit(me); // bewaart practitionerId/naam indien aanwezig
        else localStorage.setItem("openzorg_role_source", "demo");
        effectieveRol = (data.role || role) as OpenZorgRole;
        localStorage.setItem("openzorg_role", effectieveRol);
      }

      // Detect master admin — server checks against master_admins table
      const isMaster = data.isMaster === true;
      localStorage.setItem("openzorg_is_master", isMaster ? "true" : "false");

      // Feature-flags + branding voor deze tenant ophalen en cachen.
      // Fire-and-forget: als het mislukt, faalt de flag-check fail-open.
      void refreshFeatureFlags();

      // Naar de startroute van de werkruimte die bij deze rol hoort.
      window.location.href = startRouteVoorGebruiker(effectieveRol, isMaster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-full max-w-md bg-raised rounded-2xl border border-default p-8 shadow-soft">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500">
              <span className="font-display text-base font-extrabold text-white tracking-tight">OZ</span>
            </div>
            <span className="font-display text-display-md font-bold text-fg tracking-tight">OpenZorg</span>
          </div>
        </div>

        <h1 className="text-heading text-fg text-center mb-1">Welkom terug</h1>
        <p className="text-body-sm text-fg-muted text-center mb-8">
          {tenantHint ? `Log in voor omgeving: ${tenantHint}` : "Log in om verder te gaan"}
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-body-sm font-medium text-fg mb-1.5">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
              placeholder="naam@zorginstelling.nl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-body-sm font-medium text-fg mb-1.5">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
            />
          </div>

          {/* Rol-keuze is enkel een demo-terugval: accounts met een gekoppelde
              server-rol (via /api/me) negeren deze keuze volledig. */}
          <div>
            <label htmlFor="role" className="block text-body-sm font-medium text-fg mb-1.5">
              Rol (alleen voor demo-accounts)
            </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            <p className="text-caption text-fg-subtle mt-1.5">
              Heeft je account een gekoppelde rol, dan wordt die gebruikt en wordt deze keuze genegeerd.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-4 text-body-sm text-coral-700 dark:text-coral-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-3 rounded-xl text-body-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-soft"
          >
            {loading ? "Bezig met inloggen..." : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}
