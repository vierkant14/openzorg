"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

import { ClientHeader, type ClientResource } from "./ClientHeader";
import { TabNav } from "./TabNav";

export default function EcdDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params?.id;

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

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <ClientHeader client={client} />
        <TabNav clientId={id!} />
        <div className="mt-6">{children}</div>
      </div>
    </AppShell>
  );
}
