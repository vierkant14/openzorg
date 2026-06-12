"use client";

import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

import { ClientHeader, type ClientResource } from "./ClientHeader";
import { TabNav, TABS } from "./TabNav";

export default function EcdDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params?.id;
  // Op de base-route (`/ecd/<id>`) rendert de monolith-pagina zijn eigen
  // rijke client-header met foto, edit-knoppen en signaleringen. We
  // onderdrukken de simpele layout-header daar om dubbele kop te voorkomen.
  const isBaseRoute = pathname === `/ecd/${id}`;

  const [client, setClient] = useState<ClientResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    ecdFetch<ClientResource>(`/api/clients/${id}`).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setClient(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-fg-muted">Laden…</div>
        </div>
      </AppShell>
    );
  }

  if (error || !client) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-coral-600">{error ?? "Cliënt niet gevonden."}</p>
        </div>
      </AppShell>
    );
  }

  // Client display name
  const clientName = (() => {
    const n = client.name?.[0];
    if (n?.text) return n.text;
    const given = n?.given?.join(" ") ?? "";
    const family = n?.family ?? "";
    return `${given} ${family}`.trim() || "Onbekend";
  })();

  // Derive current tab label from pathname
  const pathSegments = pathname.split("/");
  const lastSegment = pathSegments[pathSegments.length - 1];
  const currentTab = TABS.find((t) => t.slug === lastSegment);
  const currentTabLabel = currentTab?.label ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb navigatie */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm">
          <a href="/ecd" className="text-fg hover:text-brand-600 transition-colors">
            Cli&euml;nten
          </a>
          <span className="text-fg-muted">&gt;</span>
          {isBaseRoute ? (
            <span className="text-fg font-medium">{clientName}</span>
          ) : (
            <a href={`/ecd/${id}`} className="text-fg hover:text-brand-600 transition-colors">
              {clientName}
            </a>
          )}
          {currentTabLabel && !isBaseRoute && (
            <>
              <span className="text-fg-muted">&gt;</span>
              <span className="text-fg font-medium">{currentTabLabel}</span>
            </>
          )}
        </nav>

        {!isBaseRoute && <ClientHeader client={client} />}
        <TabNav clientId={id!} />
        <div className="mt-6">{children}</div>
      </div>
    </AppShell>
  );
}
