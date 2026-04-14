/**
 * Feature-flags consumer (Plan 2C — fase 4).
 *
 * Leest per-tenant feature-flags + branding vanuit localStorage, gevuld bij
 * login via /api/tenant-features. Fallback: alle flags gelden als 'true'
 * zodat onbekende flags nooit per ongeluk features verbergen.
 */

import { useEffect, useState } from "react";

export type FeatureFlagSlug =
  | "workflow-engine"
  | "bpmn-canvas"
  | "dmn-editor"
  | "facturatie-module"
  | "planning-module"
  | "mic-meldingen"
  | "rapportages-ai"
  | "sales-canvas";

export interface FeatureFlag {
  enabled: boolean;
  rolloutDate?: string;
  notes?: string;
}

export interface TenantBranding {
  logoUrl: string;
  primaryColor: string;
  organizationNameOverride: string;
}

export interface TenantFeatures {
  featureFlags: Record<string, FeatureFlag>;
  branding: TenantBranding;
}

const STORAGE_KEY = "openzorg_features";

function readStorage(): TenantFeatures | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TenantFeatures;
  } catch {
    return null;
  }
}

function writeStorage(features: TenantFeatures): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
    // Notify other tabs + hooks in same tab
    window.dispatchEvent(new Event("openzorg-features-updated"));
  } catch {
    // Quota error — silently ignore
  }
}

/**
 * Fetch fresh feature-flags from the ecd service. Called after login and
 * periodically (every 5 min) to pick up admin changes.
 */
export async function refreshFeatureFlags(): Promise<TenantFeatures | null> {
  if (typeof window === "undefined") return null;
  const tenantId = localStorage.getItem("openzorg_tenant_id");
  if (!tenantId) return null;

  try {
    const res = await fetch("/api/ecd/api/tenant-features", {
      headers: { "X-Tenant-ID": tenantId },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TenantFeatures;
    writeStorage(data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if a feature-flag is enabled for the current tenant.
 * Fallback: returns `true` for unknown flags so new features don't
 * silently disappear.
 */
export function isFeatureEnabled(slug: FeatureFlagSlug | string): boolean {
  const features = readStorage();
  if (!features) return true; // fail-open before first fetch
  const flag = features.featureFlags[slug];
  if (!flag) return true; // unknown flag → assume enabled
  return flag.enabled;
}

/**
 * React hook: returns feature-flag status. Re-renders when flags
 * are refreshed via refreshFeatureFlags().
 */
export function useFeatureFlag(slug: FeatureFlagSlug | string): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(slug));

  useEffect(() => {
    const update = () => setEnabled(isFeatureEnabled(slug));
    window.addEventListener("openzorg-features-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("openzorg-features-updated", update);
      window.removeEventListener("storage", update);
    };
  }, [slug]);

  return enabled;
}

/**
 * React hook: returns branding config for current tenant.
 */
export function useTenantBranding(): TenantBranding {
  const [branding, setBranding] = useState<TenantBranding>(() => {
    const features = readStorage();
    return features?.branding ?? { logoUrl: "", primaryColor: "", organizationNameOverride: "" };
  });

  useEffect(() => {
    const update = () => {
      const features = readStorage();
      setBranding(features?.branding ?? { logoUrl: "", primaryColor: "", organizationNameOverride: "" });
    };
    window.addEventListener("openzorg-features-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("openzorg-features-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return branding;
}
