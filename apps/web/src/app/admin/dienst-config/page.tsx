"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface Organization {
  id: string;
  name?: string;
  partOf?: { reference?: string };
}

interface OrgBundle {
  entry?: Array<{ resource: Organization }>;
}

interface DienstType {
  code: string;
  naam: string;
  start: string;
  eind: string;
  kleur: string;
}

interface DienstConfigResponse {
  diensttypen: DienstType[];
  inherited?: boolean;
  isDefault?: boolean;
  orgId?: string | null;
  erftVan?: string;
}

/* ---------- Helpers ---------- */

function buildOrgTree(orgs: Organization[]): Array<{ org: Organization; depth: number }> {
  const childMap = new Map<string | null, Organization[]>();
  for (const org of orgs) {
    const parentRef = org.partOf?.reference?.replace("Organization/", "") ?? null;
    if (!childMap.has(parentRef)) childMap.set(parentRef, []);
    childMap.get(parentRef)!.push(org);
  }

  const result: Array<{ org: Organization; depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    const children = childMap.get(parentId) ?? [];
    for (const child of children) {
      result.push({ org: child, depth });
      walk(child.id, depth + 1);
    }
  }

  // Find roots: orgs whose partOf doesn't reference another org in our list
  const orgIds = new Set(orgs.map((o) => o.id));
  const roots = orgs.filter((o) => {
    const parentId = o.partOf?.reference?.replace("Organization/", "") ?? null;
    return parentId === null || !orgIds.has(parentId);
  });

  for (const root of roots) {
    result.push({ org: root, depth: 0 });
    walk(root.id, 1);
  }

  return result;
}

/* ---------- Page ---------- */

export default function DienstConfigPage() {
  const [orgs, setOrgs] = useState<Array<{ org: Organization; depth: number }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [diensttypen, setDiensttypen] = useState<DienstType[]>([]);
  const [inherited, setInherited] = useState(false);
  const [inheritedFrom, setInheritedFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load organizations
  useEffect(() => {
    (async () => {
      const { data } = await ecdFetch<OrgBundle>("/api/organisatie?_count=100");
      if (data?.entry) {
        const orgList = data.entry.map((e) => e.resource);
        const tree = buildOrgTree(orgList);
        setOrgs(tree);
        if (tree.length > 0 && !selectedOrgId) {
          setSelectedOrgId(tree[0]!.org.id);
        }
      }
      setLoading(false);
    })();
  }, []);

  // Load config when org changes
  const loadConfig = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setError(null);
    setSuccess(null);
    const { data, error: err } = await planningFetch<DienstConfigResponse>(
      `/api/dienst-config/${orgId}`,
    );
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      setDiensttypen(data.diensttypen);
      setInherited(data.inherited ?? data.isDefault ?? false);
      setInheritedFrom(data.orgId !== orgId ? (data.orgId ?? null) : null);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadConfig(selectedOrgId);
  }, [selectedOrgId, loadConfig]);

  // Inline editing handlers
  const updateField = (index: number, field: keyof DienstType, value: string) => {
    setDiensttypen((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const addRow = () => {
    setDiensttypen((prev) => [
      ...prev,
      { code: "", naam: "", start: "08:00", eind: "16:00", kleur: "#6366f1" },
    ]);
  };

  const deleteRow = (index: number) => {
    setDiensttypen((prev) => prev.filter((_, i) => i !== index));
  };

  // Save
  const handleSave = async () => {
    if (!selectedOrgId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: err } = await planningFetch(`/api/dienst-config/${selectedOrgId}`, {
      method: "PUT",
      body: JSON.stringify({ diensttypen }),
    });

    if (err) {
      setError(err);
    } else {
      setSuccess("Dienst-configuratie opgeslagen");
      setInherited(false);
      setInheritedFrom(null);
    }
    setSaving(false);
  };

  // Revert to inheritance
  const handleRevert = async () => {
    if (!selectedOrgId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: err } = await planningFetch(`/api/dienst-config/${selectedOrgId}`, {
      method: "DELETE",
    });

    if (err) {
      setError(err);
    } else {
      setSuccess("Configuratie teruggevallen op overerving");
      await loadConfig(selectedOrgId);
    }
    setSaving(false);
  };

  // Find org name by id
  const getOrgName = (id: string | null) => {
    if (!id) return "standaard";
    const found = orgs.find((o) => o.org.id === id);
    return found?.org.name ?? id;
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-display font-bold text-fg mb-6">
          Dienst-configuratie
        </h1>

        {/* Organization picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-fg-muted mb-1">
            Organisatie-eenheid
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg border border-default bg-raised text-fg text-sm"
          >
            {orgs.map(({ org, depth }) => (
              <option key={org.id} value={org.id}>
                {"\u00A0\u00A0".repeat(depth)}{org.name ?? org.id}
              </option>
            ))}
          </select>
        </div>

        {/* Inheritance badge */}
        {inherited && (
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200">
              Erft van: {getOrgName(inheritedFrom)}
            </span>
            <button
              onClick={() => { setInherited(false); }}
              className="text-sm text-brand-600 hover:text-brand-800 dark:text-brand-400 font-medium"
            >
              Eigen configuratie aanmaken
            </button>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-default">
              <table className="w-full text-sm">
                <thead className="bg-sunken">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Naam</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Start</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Eind</th>
                    <th className="text-left px-4 py-3 font-medium text-fg-muted">Kleur</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {diensttypen.map((d, idx) => (
                    <tr key={idx} className="bg-raised hover:bg-sunken/50 transition-colors">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={d.code}
                          onChange={(e) => updateField(idx, "code", e.target.value)}
                          className="w-24 px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                          placeholder="code"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={d.naam}
                          onChange={(e) => updateField(idx, "naam", e.target.value)}
                          className="w-40 px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                          placeholder="Naam"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="time"
                          value={d.start}
                          onChange={(e) => updateField(idx, "start", e.target.value)}
                          className="px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="time"
                          value={d.eind}
                          onChange={(e) => updateField(idx, "eind", e.target.value)}
                          className="px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={d.kleur}
                            onChange={(e) => updateField(idx, "kleur", e.target.value)}
                            className="w-8 h-8 rounded border border-default cursor-pointer"
                          />
                          <span className="text-xs text-fg-muted font-mono">{d.kleur}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => deleteRow(idx)}
                          className="text-coral-500 hover:text-coral-700 dark:text-coral-400 text-lg font-bold"
                          title="Verwijderen"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={addRow}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-default bg-raised text-fg hover:bg-sunken transition-colors"
              >
                + Dienst toevoegen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
              {!inherited && (
                <button
                  onClick={handleRevert}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-coral-300 dark:border-coral-700 text-coral-600 dark:text-coral-400 hover:bg-coral-50 dark:hover:bg-coral-950/20 disabled:opacity-50 transition-colors"
                >
                  Terugzetten naar overerving
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
