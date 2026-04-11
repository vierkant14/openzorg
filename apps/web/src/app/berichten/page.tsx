"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ---------- Types ---------- */

interface FhirReference {
  reference?: string;
  display?: string;
}

interface CommunicationPayload {
  contentString?: string;
}

interface CommunicationTopic {
  text?: string;
}

interface Communication {
  id: string;
  resourceType: "Communication";
  status?: string;
  sent?: string;
  received?: string;
  sender?: FhirReference;
  recipient?: FhirReference[];
  payload?: CommunicationPayload[];
  topic?: CommunicationTopic;
}

interface CommunicationBundle {
  entry?: Array<{ resource: Communication }>;
}

/* ---------- Helpers ---------- */

function getOnderwerp(c: Communication): string {
  return c.topic?.text ?? "(geen onderwerp)";
}

function getBericht(c: Communication): string {
  return c.payload?.[0]?.contentString ?? "";
}

function getAfzender(c: Communication): string {
  return c.sender?.display ?? c.sender?.reference ?? "Onbekend";
}

function isGelezen(c: Communication): boolean {
  return !!c.received;
}

function formatDatum(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Page ---------- */

export default function BerichtenPage() {
  const [berichten, setBerichten] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recipientId, setRecipientId] = useState("");
  const [senderId, setSenderId] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [bericht, setBericht] = useState("");
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Communication | null>(null);

  async function loadBerichten() {
    setLoading(true);
    const { data, error: err } = await ecdFetch<CommunicationBundle>(
      "/api/berichten",
    );
    setBerichten(data?.entry?.map((e) => e.resource) ?? []);
    setError(err);
    setLoading(false);
  }

  useEffect(() => {
    loadBerichten();
  }, []);

  async function handleMarkGelezen(id: string) {
    const { error: err } = await ecdFetch(`/api/berichten/${id}/gelezen`, {
      method: "PATCH",
    });
    if (err) {
      setError(err);
      return;
    }
    await loadBerichten();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: err } = await ecdFetch("/api/berichten", {
      method: "POST",
      body: JSON.stringify({
        recipientId,
        senderId: senderId || undefined,
        onderwerp,
        bericht,
      }),
    });

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }

    setRecipientId("");
    setSenderId("");
    setOnderwerp("");
    setBericht("");
    await loadBerichten();
  }

  const unreadCount = berichten.filter((b) => !isGelezen(b)).length;

  const inputClass =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  const btnPrimary =
    "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <a
          href="/dashboard"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug
        </a>

        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-fg">Berichten</h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-coral-500 text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm">
            {error}
          </div>
        )}

        {/* ============ BERICHTENLIJST ============ */}
        <section className="bg-raised rounded-lg border">
          {loading ? (
            <p className="p-6 text-sm text-fg-subtle">Laden...</p>
          ) : berichten.length === 0 ? (
            <p className="p-6 text-sm text-fg-subtle">
              Geen berichten gevonden.
            </p>
          ) : (
            <div className="divide-y">
              {berichten.map((b) => {
                const gelezen = isGelezen(b);
                const isSelected = selected?.id === b.id;
                return (
                  <div key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(isSelected ? null : b)}
                      className={`w-full text-left px-6 py-4 hover:bg-sunken transition-colors ${
                        !gelezen ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {!gelezen && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`text-sm truncate ${
                                !gelezen ? "font-semibold text-fg" : "text-fg-muted"
                              }`}
                            >
                              {getOnderwerp(b)}
                            </p>
                            <p className="text-xs text-fg-subtle truncate">
                              Van: {getAfzender(b)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-fg-subtle flex-shrink-0 ml-4">
                          {formatDatum(b.sent)}
                        </span>
                      </div>
                    </button>

                    {isSelected && (
                      <div className="px-6 pb-4 bg-page border-t">
                        <p className="text-sm text-fg-muted whitespace-pre-wrap py-3">
                          {getBericht(b)}
                        </p>
                        {!gelezen && (
                          <button
                            type="button"
                            onClick={() => handleMarkGelezen(b.id)}
                            className="text-xs text-brand-700 hover:text-brand-900 font-medium"
                          >
                            Markeer als gelezen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ============ NIEUW BERICHT ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Nieuw bericht
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Ontvanger (FHIR referentie)
                </label>
                <input
                  type="text"
                  required
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="Practitioner/abc123"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Afzender (FHIR referentie)
                </label>
                <input
                  type="text"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="Practitioner/def456"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">
                Onderwerp
              </label>
              <input
                type="text"
                value={onderwerp}
                onChange={(e) => setOnderwerp(e.target.value)}
                placeholder="Overdracht avonddienst"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">
                Bericht
              </label>
              <textarea
                required
                rows={4}
                value={bericht}
                onChange={(e) => setBericht(e.target.value)}
                placeholder="Typ uw bericht..."
                className={inputClass}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className={btnPrimary}
              >
                {saving ? "Verzenden..." : "Bericht verzenden"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
