"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface Role {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  active: boolean;
}

const AVAILABLE_PERMISSIONS: Array<{ category: string; permissions: Array<{ slug: string; label: string }> }> = [
  {
    category: "Clienten",
    permissions: [
      { slug: "clients:read", label: "Lezen" },
      { slug: "clients:write", label: "Schrijven" },
      { slug: "clients:delete", label: "Verwijderen" },
    ],
  },
  {
    category: "Zorgplan",
    permissions: [
      { slug: "zorgplan:read", label: "Lezen" },
      { slug: "zorgplan:write", label: "Schrijven" },
    ],
  },
  {
    category: "Rapportage",
    permissions: [
      { slug: "rapportage:read", label: "Lezen" },
      { slug: "rapportage:write", label: "Schrijven" },
    ],
  },
  {
    category: "Medicatie",
    permissions: [
      { slug: "medicatie:read", label: "Lezen" },
      { slug: "medicatie:write", label: "Schrijven" },
    ],
  },
  {
    category: "MIC",
    permissions: [
      { slug: "mic:read", label: "Lezen" },
      { slug: "mic:write", label: "Schrijven" },
    ],
  },
  {
    category: "Planning",
    permissions: [
      { slug: "planning:read", label: "Lezen" },
      { slug: "planning:write", label: "Schrijven" },
    ],
  },
  {
    category: "Beheer",
    permissions: [
      { slug: "medewerkers:read", label: "Medewerkers lezen" },
      { slug: "medewerkers:write", label: "Medewerkers schrijven" },
      { slug: "organisatie:read", label: "Organisatie lezen" },
      { slug: "configuratie:read", label: "Configuratie lezen" },
      { slug: "configuratie:write", label: "Configuratie schrijven" },
      { slug: "workflows:read", label: "Workflows lezen" },
      { slug: "workflows:write", label: "Workflows schrijven" },
      { slug: "rollen:read", label: "Rollen lezen" },
      { slug: "rollen:write", label: "Rollen schrijven" },
    ],
  },
];

export default function RollenPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const [newSlug, setNewSlug] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editDisplay, setEditDisplay] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await ecdFetch<{ roles: Role[] }>("/api/admin/rollen");
    setRoles(data?.roles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditDisplay(selected.display_name);
      setEditDescription(selected.description);
      setEditPermissions(new Set(selected.permissions));
    }
  }, [selected]);

  function togglePermission(slug: string) {
    setEditPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    const { error } = await ecdFetch(`/api/admin/rollen/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify({
        displayName: editDisplay,
        description: editDescription,
        permissions: Array.from(editPermissions),
      }),
    });
    setSaving(false);
    if (error) {
      setStatus({ ok: false, text: `Opslaan mislukt: ${error}` });
    } else {
      setStatus({ ok: true, text: "Opgeslagen" });
      load();
      setTimeout(() => setStatus(null), 2500);
    }
  }

  async function createRole() {
    if (!newSlug || !newDisplay) return;
    const { error, data } = await ecdFetch<{ id: string }>("/api/admin/rollen", {
      method: "POST",
      body: JSON.stringify({
        slug: newSlug,
        displayName: newDisplay,
        description: newDescription,
        permissions: [],
      }),
    });
    if (error) {
      setStatus({ ok: false, text: error });
      return;
    }
    setShowNew(false);
    setNewSlug("");
    setNewDisplay("");
    setNewDescription("");
    await load();
    if (data?.id) setSelectedId(data.id);
  }

  async function deleteRole() {
    if (!selected || selected.is_system) return;
    if (!confirm(`Rol '${selected.display_name}' verwijderen?`)) return;
    const { error } = await ecdFetch(`/api/admin/rollen/${selected.id}`, { method: "DELETE" });
    if (error) {
      setStatus({ ok: false, text: error });
    } else {
      setSelectedId(null);
      load();
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Rollen beheer</h1>
            <p className="mt-1 text-sm text-fg-muted">
              Systeem-rollen zijn locked. Eigen rollen (controller, kwaliteitsmedewerker, etc.) kun je vrij aanpassen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            + Nieuwe rol
          </button>
        </div>

        {status && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              status.ok
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {status.text}
          </div>
        )}

        {showNew && (
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/30 p-4 dark:border-brand-800 dark:bg-brand-950/10">
            <h3 className="mb-3 text-sm font-semibold text-fg">Nieuwe rol aanmaken</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Slug (technisch)</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="bv. wijkcoordinator"
                  className="w-full rounded-lg border border-default bg-raised px-3 py-2 font-mono text-sm text-fg"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Weergavenaam</label>
                <input
                  type="text"
                  value={newDisplay}
                  onChange={(e) => setNewDisplay(e.target.value)}
                  placeholder="bv. Wijkcoördinator"
                  className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Beschrijving</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Korte omschrijving"
                  className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={createRole}
                disabled={!newSlug || !newDisplay}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                Aanmaken
              </button>
              <button
                type="button"
                onClick={() => { setShowNew(false); setNewSlug(""); setNewDisplay(""); setNewDescription(""); }}
                className="text-sm text-fg-muted hover:text-fg"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-fg-muted">Laden...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-xl border border-default bg-raised p-2 h-fit">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === role.id
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
                      : "text-fg-muted hover:bg-sunken"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{role.display_name}</span>
                    {role.is_system && (
                      <span className="inline-flex items-center rounded bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 text-xs font-medium text-fg-subtle">
                        🔒
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-fg-subtle font-mono">{role.slug}</div>
                </button>
              ))}
            </aside>

            <div className="rounded-xl border border-default bg-raised p-6">
              {!selected ? (
                <p className="text-sm text-fg-muted">Kies een rol links om te bekijken of te bewerken.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-fg">{selected.display_name}</h2>
                      <p className="font-mono text-xs text-fg-subtle">{selected.slug}</p>
                    </div>
                    {selected.is_system ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-100 dark:bg-surface-800 px-3 py-1 text-xs font-medium text-fg-muted">
                        🔒 Systeem-rol (locked)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={deleteRole}
                        className="text-sm text-coral-600 hover:text-coral-800"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Weergavenaam</label>
                    <input
                      type="text"
                      value={editDisplay}
                      onChange={(e) => setEditDisplay(e.target.value)}
                      disabled={selected.is_system}
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Beschrijving</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={selected.is_system}
                      rows={2}
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Permissions</label>
                    <div className="space-y-3">
                      {AVAILABLE_PERMISSIONS.map((cat) => (
                        <div key={cat.category}>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                            {cat.category}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {cat.permissions.map((perm) => (
                              <label
                                key={perm.slug}
                                className={`flex items-center gap-2 rounded-lg border border-default bg-page px-3 py-2 text-xs ${
                                  selected.is_system ? "opacity-60" : "cursor-pointer hover:bg-sunken"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={editPermissions.has(perm.slug)}
                                  onChange={() => togglePermission(perm.slug)}
                                  disabled={selected.is_system}
                                  className="rounded"
                                />
                                <span className="flex-1">{perm.label}</span>
                                <code className="text-fg-subtle">{perm.slug}</code>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!selected.is_system && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                      >
                        {saving ? "Opslaan..." : "Wijzigingen opslaan"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
