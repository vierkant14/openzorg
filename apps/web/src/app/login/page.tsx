"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const ROLES = [
  { value: "beheerder", label: "Beheerder" },
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
      if (data.profile?.display) {
        localStorage.setItem("openzorg_user_name", data.profile.display);
      }

      // Store role — in production this comes from Medplum PractitionerRole
      localStorage.setItem("openzorg_role", data.role || role);

      // Detect master admin — the platform super admin account
      // Server can return isMaster flag; fallback: check admin email
      const isMaster = data.isMaster === true
        || email.toLowerCase() === "admin@openzorg.nl";
      localStorage.setItem("openzorg_is_master", isMaster ? "true" : "false");

      window.location.href = "/dashboard";
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
        <p className="text-body-sm text-fg-muted text-center mb-8">Log in om verder te gaan</p>

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
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
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
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-body-sm font-medium text-fg mb-1.5">
              Rol
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-caption text-fg-subtle mt-1.5">
              In productie wordt je rol automatisch bepaald door de beheerder.
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
