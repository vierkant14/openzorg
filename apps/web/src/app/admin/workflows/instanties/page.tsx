"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy-route — de instantie-weergave is opgegaan in de Processen-hub
 * (tab "Lopend"). Deze pagina redirect zodat bladwijzers blijven werken.
 */
export default function InstantiesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/workflows?tab=lopend");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="text-sm text-fg-muted">Doorgestuurd naar Processen › Lopend…</div>
    </div>
  );
}
