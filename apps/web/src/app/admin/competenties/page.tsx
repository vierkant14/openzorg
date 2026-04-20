"use client";

import { KERN_COMPETENTIES, UITBREIDING_COMPETENTIES } from "@openzorg/shared-domain";
import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";

/* ---------- Types ---------- */

interface OrganisatieCompetentie {
  code: string;
  naam: string;
  beschrijving: string;
}

/* ---------- LocalStorage key ---------- */

const STORAGE_KEY = "openzorg_org_competenties";

function loadOrgCompetenties(): OrganisatieCompetentie[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OrganisatieCompetentie[]) : [];
  } catch {
    return [];
  }
}

function saveOrgCompetenties(items: OrganisatieCompetentie[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ---------- Page ---------- */

export default function CompetentiesPage() {
  // Uitbreiding toggles: map of code -> active
  const [uitbreidingActief, setUitbreidingActief] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem("openzorg_uitbreiding_actief");
    if (stored) {
      try {
        return JSON.parse(stored) as Record<string, boolean>;
      } catch { /* ignore */ }
    }
    // Default: all active
    const defaults: Record<string, boolean> = {};
    for (const c of UITBREIDING_COMPETENTIES) {
      defaults[c.code] = true;
    }
    return defaults;
  });

  // Organisatie-specifiek
  const [orgCompetenties, setOrgCompetenties] = useState<OrganisatieCompetentie[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<OrganisatieCompetentie>({ code: "", naam: "", beschrijving: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  // Load org competenties on mount
  useEffect(() => {
    setOrgCompetenties(loadOrgCompetenties());
  }, []);

  // Persist uitbreiding toggles
  useEffect(() => {
    localStorage.setItem("openzorg_uitbreiding_actief", JSON.stringify(uitbreidingActief));
  }, [uitbreidingActief]);

  const toggleUitbreiding = (code: string) => {
    setUitbreidingActief((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // CRUD org competenties
  const addOrgCompetentie = () => {
    if (!newItem.code.trim() || !newItem.naam.trim()) return;
    const updated = [...orgCompetenties, { ...newItem }];
    setOrgCompetenties(updated);
    saveOrgCompetenties(updated);
    setNewItem({ code: "", naam: "", beschrijving: "" });
    setShowAddForm(false);
  };

  const updateOrgCompetentie = (index: number, field: keyof OrganisatieCompetentie, value: string) => {
    const updated = orgCompetenties.map((c, i) =>
      i === index ? { ...c, [field]: value } : c,
    );
    setOrgCompetenties(updated);
    saveOrgCompetenties(updated);
  };

  const deleteOrgCompetentie = (index: number) => {
    const updated = orgCompetenties.filter((_, i) => i !== index);
    setOrgCompetenties(updated);
    saveOrgCompetenties(updated);
    if (editingIndex === index) setEditingIndex(null);
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-display font-bold text-fg mb-8">
          Competenties
        </h1>

        {/* ── Section 1: Kern ── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-fg mb-1">Kern-competenties</h2>
          <p className="text-sm text-fg-muted mb-4">
            Wettelijk bepaald (Wet BIG). Niet aanpasbaar.
          </p>

          <div className="overflow-x-auto rounded-xl border border-default">
            <table className="w-full text-sm">
              <thead className="bg-sunken">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Naam</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Beschrijving</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">BIG-niveau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {KERN_COMPETENTIES.map((c) => (
                  <tr key={c.code} className="bg-raised">
                    <td className="px-4 py-2 font-mono text-xs text-fg-muted">{c.code}</td>
                    <td className="px-4 py-2 text-fg">{c.naam}</td>
                    <td className="px-4 py-2 text-fg-muted">{c.beschrijving}</td>
                    <td className="px-4 py-2 text-fg-muted">{c.bigNiveau ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 2: Uitbreiding ── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-fg mb-1">Uitbreiding-competenties</h2>
          <p className="text-sm text-fg-muted mb-4">
            Standaard beschikbaar. Per organisatie in- of uitschakelen.
          </p>

          <div className="overflow-x-auto rounded-xl border border-default">
            <table className="w-full text-sm">
              <thead className="bg-sunken">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Actief</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Naam</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Beschrijving</th>
                  <th className="text-left px-4 py-3 font-medium text-fg-muted">Sectoren</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {UITBREIDING_COMPETENTIES.map((c) => (
                  <tr key={c.code} className="bg-raised">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleUitbreiding(c.code)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          uitbreidingActief[c.code]
                            ? "bg-brand-600"
                            : "bg-surface-300 dark:bg-surface-600"
                        }`}
                        aria-label={`${c.naam} ${uitbreidingActief[c.code] ? "uitschakelen" : "inschakelen"}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            uitbreidingActief[c.code] ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-fg-muted">{c.code}</td>
                    <td className="px-4 py-2 text-fg">{c.naam}</td>
                    <td className="px-4 py-2 text-fg-muted">{c.beschrijving}</td>
                    <td className="px-4 py-2 text-fg-muted text-xs">
                      {c.sectoren.length > 0 ? c.sectoren.join(", ") : "alle"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 3: Organisatie-specifiek ── */}
        <section>
          <h2 className="text-lg font-semibold text-fg mb-1">Organisatie-specifiek</h2>
          <p className="text-sm text-fg-muted mb-4">
            {/* TODO: Persist to backend via tenant_configurations */}
            Eigen competenties voor uw organisatie. Worden lokaal opgeslagen.
          </p>

          {orgCompetenties.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-default mb-4">
              <table className="w-full text-sm">
                <thead className="bg-sunken">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Naam</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Beschrijving</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {orgCompetenties.map((c, idx) => (
                    <tr key={idx} className="bg-raised">
                      {editingIndex === idx ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={c.code}
                              onChange={(e) => updateOrgCompetentie(idx, "code", e.target.value)}
                              className="w-32 px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={c.naam}
                              onChange={(e) => updateOrgCompetentie(idx, "naam", e.target.value)}
                              className="w-40 px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={c.beschrijving}
                              onChange={(e) => updateOrgCompetentie(idx, "beschrijving", e.target.value)}
                              className="w-full px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 font-medium"
                            >
                              Klaar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 font-mono text-xs text-fg-muted">{c.code}</td>
                          <td className="px-4 py-2 text-fg">{c.naam}</td>
                          <td className="px-4 py-2 text-fg-muted">{c.beschrijving}</td>
                          <td className="px-4 py-2 flex items-center gap-2">
                            <button
                              onClick={() => setEditingIndex(idx)}
                              className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => deleteOrgCompetentie(idx)}
                              className="text-sm text-coral-500 hover:text-coral-700 dark:text-coral-400"
                            >
                              Verwijderen
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form */}
          {showAddForm ? (
            <div className="rounded-xl border border-default bg-raised p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Code</label>
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={(e) => setNewItem((p) => ({ ...p, code: e.target.value }))}
                    placeholder="ORG-VOORBEELD"
                    className="w-full px-2 py-1.5 rounded border border-default bg-page text-fg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Naam</label>
                  <input
                    type="text"
                    value={newItem.naam}
                    onChange={(e) => setNewItem((p) => ({ ...p, naam: e.target.value }))}
                    placeholder="Naam competentie"
                    className="w-full px-2 py-1.5 rounded border border-default bg-page text-fg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Beschrijving</label>
                  <input
                    type="text"
                    value={newItem.beschrijving}
                    onChange={(e) => setNewItem((p) => ({ ...p, beschrijving: e.target.value }))}
                    placeholder="Korte beschrijving"
                    className="w-full px-2 py-1.5 rounded border border-default bg-page text-fg text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={addOrgCompetentie}
                  disabled={!newItem.code.trim() || !newItem.naam.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  Toevoegen
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-default bg-raised text-fg hover:bg-sunken transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-default bg-raised text-fg hover:bg-sunken transition-colors"
            >
              + Competentie toevoegen
            </button>
          )}
        </section>
      </main>
    </AppShell>
  );
}
