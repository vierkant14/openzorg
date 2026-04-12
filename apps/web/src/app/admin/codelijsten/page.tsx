"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface CodeItem {
  code: string;
  display: string;
}

interface SnomedResult {
  conceptId: string;
  term: string;
  fsn: string;
  semanticTag: string;
}

interface CodelijstType {
  key: string;
  label: string;
}

export default function CodelijstenPage() {
  const [types, setTypes] = useState<CodelijstType[]>([]);
  const [activeType, setActiveType] = useState("diagnoses");
  const [items, setItems] = useState<CodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // SNOMED search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SnomedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Custom entry (vrije invoer)
  const [customCode, setCustomCode] = useState("");
  const [customDisplay, setCustomDisplay] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  // Load types
  useEffect(() => {
    ecdFetch<{ types: CodelijstType[] }>("/api/admin/codelijsten/types")
      .then(({ data }) => { if (data) setTypes(data.types); });
  }, []);

  // Load current list
  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data } = await ecdFetch<{ items: CodeItem[] }>(`/api/admin/codelijsten/${activeType}`);
    setItems(data?.items ?? []);
    setLoading(false);
  }, [activeType]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // SNOMED search with debounce
  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await ecdFetch<{ results: SnomedResult[] }>(
        `/api/admin/codelijsten/snomed/search?q=${encodeURIComponent(query)}&type=${activeType}`,
      );
      setSearchResults(data?.results ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeType]);

  async function handleAdd(result: SnomedResult) {
    setAdding(result.conceptId);
    setMessage(null);
    const { error } = await ecdFetch(`/api/admin/codelijsten/${activeType}`, {
      method: "POST",
      body: JSON.stringify({ code: result.conceptId, display: result.term }),
    });
    if (error) {
      setMessage(error);
    } else {
      setMessage(`"${result.term}" toegevoegd aan de lijst`);
      loadItems();
    }
    setAdding(null);
  }

  async function handleRemove(code: string) {
    setRemoving(code);
    await ecdFetch(`/api/admin/codelijsten/${activeType}/${code}`, { method: "DELETE" });
    setRemoving(null);
    loadItems();
  }

  async function handleAddCustom() {
    if (!customDisplay.trim()) return;
    setAddingCustom(true);
    setMessage(null);
    const code = customCode.trim() || `OZ-${Date.now()}`;
    const { error } = await ecdFetch(`/api/admin/codelijsten/${activeType}`, {
      method: "POST",
      body: JSON.stringify({
        code,
        display: customDisplay.trim(),
        system: "https://openzorg.nl/CodeSystem/custom",
      }),
    });
    if (error) {
      setMessage(error);
    } else {
      setMessage(`"${customDisplay.trim()}" toegevoegd (eigen code)`);
      setCustomCode("");
      setCustomDisplay("");
      loadItems();
    }
    setAddingCustom(false);
  }

  const alreadyAdded = new Set(items.map((i) => i.code));

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h1 className="text-display-lg text-fg">Codelijsten</h1>
          <p className="text-body text-fg-muted mt-1">
            Beheer de termen die zorgmedewerkers kunnen kiezen bij het registreren van diagnoses, allergieën en verrichtingen.
            Zoek in SNOMED CT en voeg relevante termen toe aan je organisatielijst.
          </p>
        </div>

        {/* Type tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {types.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveType(t.key); setQuery(""); setSearchResults([]); }}
              className={`px-5 py-2.5 rounded-xl text-body-sm font-semibold transition-all ${
                activeType === t.key
                  ? "bg-brand-600 text-white shadow-soft"
                  : "bg-raised border border-default text-fg-muted hover:text-fg hover:bg-sunken"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: SNOMED search */}
          <div>
            <h2 className="text-heading text-fg mb-4">SNOMED CT zoeken</h2>
            <div className="relative mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op term (bijv. diabetes, penicilline, valrisico)..."
                className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
              />
              {searching && (
                <div className="absolute right-3 top-3.5">
                  <div className="w-5 h-5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
                </div>
              )}
            </div>

            {message && (
              <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 px-4 py-3 mb-4 text-body-sm text-brand-700 dark:text-brand-300">
                {message}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
                <div className="divide-y divide-subtle">
                  {searchResults.map((r) => {
                    const isAdded = alreadyAdded.has(r.conceptId);
                    return (
                      <div key={r.conceptId} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-sunken transition-colors">
                        <div className="min-w-0">
                          <p className="text-body-sm text-fg font-medium truncate">{r.term}</p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-caption text-fg-subtle font-mono">{r.conceptId}</span>
                            {r.semanticTag && (
                              <span className="text-caption text-fg-subtle">({r.semanticTag})</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAdd(r)}
                          disabled={isAdded || adding === r.conceptId}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-caption font-medium transition-colors ${
                            isAdded
                              ? "bg-brand-50 text-brand-600 cursor-default"
                              : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                          }`}
                        >
                          {isAdded ? "✓ Toegevoegd" : adding === r.conceptId ? "..." : "Toevoegen"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {query.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-body-sm text-fg-subtle py-4">Geen resultaten gevonden voor &quot;{query}&quot;</p>
            )}

            {query.length < 2 && (
              <div className="text-center py-8">
                <p className="text-body-sm text-fg-subtle">Typ minimaal 2 tekens om te zoeken in SNOMED CT</p>
                <p className="text-caption text-fg-subtle mt-1">
                  SNOMED CT bevat 350.000+ medische termen. Zoek specifiek voor de beste resultaten.
                </p>
              </div>
            )}

            {/* Vrije invoer — for items not in SNOMED CT */}
            <div className="mt-6 bg-raised rounded-2xl border border-default p-5">
              <h3 className="text-body-sm font-semibold text-fg mb-1">Eigen term toevoegen</h3>
              <p className="text-caption text-fg-subtle mb-3">
                Niet alles staat in SNOMED CT (bijv. voeding, specifieke hulpmiddelen). Voeg hier eigen termen toe.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customDisplay}
                  onChange={(e) => setCustomDisplay(e.target.value)}
                  placeholder="Naam (bijv. Glutenvrij dieet)"
                  className="flex-1 border border-default bg-raised rounded-lg px-3 py-2 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none"
                />
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Code (optioneel)"
                  className="w-32 border border-default bg-raised rounded-lg px-3 py-2 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none font-mono"
                />
                <button
                  onClick={handleAddCustom}
                  disabled={!customDisplay.trim() || addingCustom}
                  className="shrink-0 px-4 py-2 bg-navy-600 text-white rounded-lg text-caption font-medium hover:bg-navy-700 disabled:opacity-50"
                >
                  {addingCustom ? "..." : "Toevoegen"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Current org list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading text-fg">Organisatielijst</h2>
              <span className="text-caption text-fg-subtle">{items.length} termen</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="bg-raised rounded-2xl border border-default p-8 text-center">
                <p className="text-body-sm text-fg-muted">Nog geen termen toegevoegd.</p>
                <p className="text-caption text-fg-subtle mt-1">
                  Zoek in SNOMED CT en voeg relevante termen toe voor je medewerkers.
                </p>
              </div>
            ) : (
              <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
                <div className="divide-y divide-subtle">
                  {items.map((item) => (
                    <div key={item.code} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-sm text-fg font-medium truncate">{item.display}</p>
                        <span className="text-caption text-fg-subtle font-mono">{item.code}</span>
                      </div>
                      <button
                        onClick={() => handleRemove(item.code)}
                        disabled={removing === item.code}
                        className="shrink-0 text-caption text-coral-500 hover:text-coral-600 font-medium disabled:opacity-50"
                      >
                        {removing === item.code ? "..." : "Verwijderen"}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-subtle bg-sunken">
                  <p className="text-caption text-fg-subtle">
                    Deze termen zijn beschikbaar voor zorgmedewerkers bij het registreren van {types.find((t) => t.key === activeType)?.label.toLowerCase() ?? activeType}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
