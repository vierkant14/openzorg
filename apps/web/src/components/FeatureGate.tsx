"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type FeatureFlagSlug, isFeatureEnabled } from "../lib/features";

interface FeatureGateProps {
  flag: FeatureFlagSlug;
  children: React.ReactNode;
  /** Waar naartoe als de flag uit staat. Default: /geen-toegang */
  redirectTo?: string;
}

/**
 * Wrapper die children alleen rendert als de feature-flag aan staat.
 * Als uit → redirect naar redirectTo (default /geen-toegang). Geeft een
 * kleine "laden..."-spinner tijdens de client-side hydratatie zodat je
 * geen flash van de gated content krijgt.
 *
 * Gebruik in app-router pagina's:
 *   export default function Page() {
 *     return (
 *       <FeatureGate flag="bpmn-canvas">
 *         <CanvasPage />
 *       </FeatureGate>
 *     );
 *   }
 */
export function FeatureGate({ flag, children, redirectTo = "/geen-toegang" }: FeatureGateProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const ok = isFeatureEnabled(flag);
    setAllowed(ok);
    setChecked(true);
    if (!ok) {
      router.replace(redirectTo);
    }
  }, [flag, redirectTo, router]);

  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-fg-muted">Controleren of deze feature beschikbaar is...</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-fg-muted">Doorgestuurd...</div>
      </div>
    );
  }

  return <>{children}</>;
}
