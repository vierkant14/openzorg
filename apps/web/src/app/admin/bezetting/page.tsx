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
}

interface RolEis {
  competentie: string;
  minimum: number;
}

interface BezettingsEis {
  dienstCode: string;
  rollen: RolEis[];
}

interface BezettingsResponse {
  orgId: string;
  eisen: BezettingsEis[];
}

/* ---------- Constants ---------- */

const BESCHIKBARE_ROLLEN = [
  { code: "verpleegkundige", label: "Verpleegkundige" },
  { code: "verzorgende-ig", label: "Verzorgende-IG" },
  { code: "verzorgende", label: "Verzorgende" },
  { code: "helpende", label: "Helpende" },
  { code: "VH-INJECTIES", label: "Injecties toedienen" },
  { code: "VH-MEDICATIE", label: "Medicatie (risicovol)" },
  { code: "UIT-PALLIATIEF", label: "Palliatieve zorg" },
  { code: "UIT-DEMENTIE", label: "Dementiezorg" },
  { code: "UIT-WOND", label: "Wondzorg" },
];

/* ---------- Helpers ---------- */

function buildOrgTree(orgs: Organization[]): Array<{ org: Organization; depth: number }> {
  const childMap = new Map<string | null, Organization[]>();
  for (const org of orgs) {
    const parentRef = org.partOf?.reference?.replace("Organization/", "") ?? null;
    if (!childMap.has(parentRef)) childMap.set(parentRef, []);
    childMap.get(parentRef)!.push(org);
  }

  const result: Array<{ org: Organization; depth: number }> = [];
  const orgIds = new Set(orgs.map((o) => o.id));
  const roots = orgs.filter((o) => {
    const parentId = o.partOf?.reference?.replace("Organization/", "") ?? null;
    return parentId === null || !orgIds.has(parentId);
  });

  function walk(parentId: string | null, depth: number) {
    const children = childMap.get(parentId) ?? [];
    for (const child of children) {
      result.push({ org: child, depth });
      walk(child.id, depth + 1);
    }
  }

  for (const root of roots) {
    result.push({ org: root, depth: 0 });
    walk(root.id, 1);
  }
  return result;
}

function getRolLabel(code: string): string {
  return BESCHIKBARE_ROLLEN.find((r) => r.code === code)?.label ?? code;
}

/* ---------- Page ---------- */

export default function BezettingPage() {
  const [orgs, setOrgs] = useState<Array<{ org: Organization; depth: number }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [diensttypen, setDiensttypen] = useState<DienstType[]>([]);
  const [eisen, setEisen] = useState<BezettingsEis[]>([]);
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

  // Load dienst-config + bezettingsprofiel when org changes
  const loadData = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setError(null);
    setSuccess(null);

    const [configRes, bezettingRes] = await Promise.all([
      planningFetch<DienstConfigResponse>(`/api/dienst-config/${orgId}`),
      planningFetch<BezettingsResponse>(`/api/bezetting/${orgId}`),
    ]);

    if (configRes.error) {
      setError(configRes.error);
      return;
    }

    const diensten = configRes.data?.diensttypen ?? [];
    setDiensttypen(diensten);

    // Merge existing eisen with diensten (ensure every dienst has an entry)
    const existingEisen = bezettingRes.data?.eisen ?? [];
    const merged: BezettingsEis[] = diensten.map((d) => {
      const existing = existingEisen.find((e) => e.dienstCode === d.code);
      return existing ?? { dienstCode: d.code, rollen: [] };
    });
    setEisen(merged);
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadData(selectedOrgId);
  }, [selectedOrgId, loadData]);

  // Edit handlers
  const updateMinimum = (dienstIndex: number, rolIndex: number, value: number) => {
    setEisen((prev) =>
      prev.map((eis, di) =>
        di === dienstIndex
          ? {
              ...eis,
              rollen: eis.rollen.map((r, ri) =>
                ri === rolIndex ? { ...r, minimum: Math.max(0, value) } : r,
              ),
            }
          : eis,
      ),
    );
  };

  const addRol = (dienstIndex: number, competentie: string) => {
    if (!competentie) return;
    setEisen((prev) =>
      prev.map((eis, di) =>
        di === dienstIndex
          ? { ...eis, rollen: [...eis.rollen, { competentie, minimum: 1 }] }
          : eis,
      ),
    );
  };

  const removeRol = (dienstIndex: number, rolIndex: number) => {
    setEisen((prev) =>
      prev.map((eis, di) =>
        di === dienstIndex
          ? { ...eis, rollen: eis.rollen.filter((_, ri) => ri !== rolIndex) }
          : eis,
      ),
    );
  };

  // Save
  const handleSave = async () => {
    if (!selectedOrgId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Only send eisen that have at least one rol
    const payload = eisen.filter((e) => e.rollen.length > 0);

    const { error: err } = await planningFetch(`/api/bezetting/${selectedOrgId}`, {
      method: "PUT",
      body: JSON.stringify({ eisen: payload }),
    });

    if (err) {
      setError(err);
    } else {
      setSuccess("Bezettingsprofiel opgeslagen");
    }
    setSaving(false);
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-display font-bold text-fg mb-6">
          Bezetting &amp; normen
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
          </div>
        ) : diensttypen.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-fg-muted">
              Geen diensttypen geconfigureerd. Stel eerst diensten in via{" "}
              <a href="/admin/dienst-config" className="text-brand-600 hover:underline">
                Dienst-configuratie
              </a>.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {eisen.map((eis, dienstIdx) => {
              const dienst = diensttypen.find((d) => d.code === eis.dienstCode);
              if (!dienst) return null;

              // Rollen already added for this dienst
              const usedCodes = new Set(eis.rollen.map((r) => r.competentie));
              const availableRollen = BESCHIKBARE_ROLLEN.filter(
                (r) => !usedCodes.has(r.code),
              );

              return (
                <div
                  key={eis.dienstCode}
                  className="rounded-xl border border-default bg-raised p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: dienst.kleur }}
                    />
                    <h3 className="font-semibold text-fg">
                      {dienst.naam}
                    </h3>
                    <span className="text-sm text-fg-muted">
                      ({dienst.start} - {dienst.eind})
                    </span>
                  </div>

                  {/* Rollen list */}
                  <div className="space-y-2 ml-7">
                    {eis.rollen.map((rol, rolIdx) => (
                      <div key={rolIdx} className="flex items-center gap-3">
                        <span className="text-fg-muted text-sm">&#9500;&#9472;&#9472;</span>
                        <span className="text-sm text-fg min-w-[160px]">
                          {getRolLabel(rol.competentie)}:
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={rol.minimum}
                          onChange={(e) =>
                            updateMinimum(dienstIdx, rolIdx, parseInt(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1 rounded border border-default bg-page text-fg text-sm text-center"
                        />
                        <button
                          onClick={() => removeRol(dienstIdx, rolIdx)}
                          className="text-coral-500 hover:text-coral-700 dark:text-coral-400 text-sm"
                          title="Verwijderen"
                        >
                          &times;
                        </button>
                      </div>
                    ))}

                    {/* Add rol */}
                    <div className="flex items-center gap-3">
                      <span className="text-fg-muted text-sm">&#9492;&#9472;&#9472;</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          addRol(dienstIdx, e.target.value);
                          e.target.value = "";
                        }}
                        className="px-2 py-1 rounded border border-default bg-page text-fg text-sm"
                      >
                        <option value="" disabled>
                          + Rol toevoegen
                        </option>
                        {availableRollen.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Save button */}
            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
