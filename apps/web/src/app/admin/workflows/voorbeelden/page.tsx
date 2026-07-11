"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy-route — de statische voorbeelden-uitleg is opgegaan in de
 * Sjablonen-tab van de Processen-hub (met stappen-preview per zorgpad).
 */
export default function VoorbeeldenRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/workflows?tab=sjablonen");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="text-sm text-fg-muted">Doorgestuurd naar Processen › Sjablonen…</div>
    </div>
  );
}
