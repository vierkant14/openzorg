"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy-route — de stappenlijst-editor is vervangen door de BPMN-canvas
 * op /admin/workflows/canvas. Deze pagina redirect automatisch zodat
 * bestaande bladwijzers blijven werken.
 */
export default function OntwerpRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/workflows/canvas");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="text-sm text-fg-muted">Doorgestuurd naar de visuele canvas-editor...</div>
    </div>
  );
}
