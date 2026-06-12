"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface StateDef { slug: string; label: string; color: string; terminal?: boolean }
interface TransitionDef { from: string; to: string; label?: string; requiredRole?: string; guard?: string }
interface StateMachine {
  resourceType: string;
  fieldPath?: string;
  initialState: string;
  states: StateDef[];
  transitions: TransitionDef[];
}

const COLOR_OPTIONS = ["blue", "amber", "emerald", "navy", "gray", "coral"] as const;

const COLOR_SWATCHES: Record<string, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  navy: "bg-navy-700",
  gray: "bg-surface-400",
  coral: "bg-coral-500",
};

const COLOR_BADGES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  navy: "bg-navy-100 text-navy-800 dark:bg-navy-950/30 dark:text-navy-300",
  gray: "bg-surface-200 text-fg-muted dark:bg-surface-800",
  coral: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

const AVAILABLE_ROLES = ["", "zorgmedewerker", "planner", "teamleider", "beheerder", "controller", "kwaliteitsmedewerker", "zorgadministratie", "mic-coordinator"] as const;

export default function StateMachinesPage() {
  const [machines, setMachines] = useState<StateMachine[]>([]);
  const [selectedType, setSelectedType] = useState<string>("Patient");
  const [machine, setMachine] = useState<StateMachine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await ecdFetch<{ machines: StateMachine[] }>("/api/admin/state-machines");
    setMachines(data?.machines ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const m = machines.find((x) => x.resourceType === selectedType);
    setMachine(m ? JSON.parse(JSON.stringify(m)) : null);
  }, [machines, selectedType]);

  function updateState(idx: number, patch: Partial<StateDef>) {
    if (!machine) return;
    const next = { ...machine, states: machine.states.map((s, i) => (i === idx ? { ...s, ...patch } : s)) };
    setMachine(next);
  }

  function addState() {
    if (!machine) return;
    setMachine({
      ...machine,
      states: [...machine.states, { slug: `new-state-${machine.states.length}`, label: "Nieuwe state", color: "gray" }],
    });
  }

  function removeState(idx: number) {
    if (!machine) return;
    const removed = machine.states[idx];
    if (!removed) return;
    if (machine.initialState === removed.slug) {
      alert("Initiale state kan niet verwijderd worden. Wijzig eerst de initial state.");
      return;
    }
    setMachine({
      ...machine,
      states: machine.states.filter((_, i) => i !== idx),
      transitions: machine.transitions.filter((t) => t.from !== removed.slug && t.to !== removed.slug),
    });
  }

  function addTransition() {
    if (!machine || machine.states.length < 2) return;
    setMachine({
      ...machine,
      transitions: [...machine.transitions, { from: machine.states[0]!.slug, to: machine.states[1]!.slug, label: "" }],
    });
  }

  function updateTransition(idx: number, patch: Partial<TransitionDef>) {
    if (!machine) return;
    setMachine({
      ...machine,
      transitions: machine.transitions.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    });
  }

  function removeTransition(idx: number) {
    if (!machine) return;
    setMachine({ ...machine, transitions: machine.transitions.filter((_, i) => i !== idx) });
  }

  async function save() {
    if (!machine) return;
    setSaving(true);
    setStatus(null);
    const { error } = await ecdFetch(`/api/admin/state-machines/${machine.resourceType}`, {
      method: "PUT",
      body: JSON.stringify(machine),
    });
    setSaving(false);
    if (error) {
      setStatus({ ok: false, text: `Opslaan mislukt: ${error}` });
    } else {
      setStatus({ ok: true, text: "State-machine opgeslagen" });
      load();
      setTimeout(() => setStatus(null), 2500);
    }
  }

  async function resetToDefaults() {
    if (!machine) return;
    if (!confirm("Tenant-override verwijderen en terug naar de defaults?")) return;
    const { error } = await ecdFetch(`/api/admin/state-machines/${machine.resourceType}/reset`, {
      method: "POST",
    });
    if (error) {
      setStatus({ ok: false, text: error });
    } else {
      setStatus({ ok: true, text: "Gereset naar defaults" });
      load();
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">State-machines</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Per resource-type definieer je welke statussen bestaan en welke overgangen toegestaan zijn.
            Guards worden bij fase 4 afgedwongen bij save — nu alleen informatief.
          </p>
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

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-fg-muted">Resource-type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
          >
            {machines.map((m) => (
              <option key={m.resourceType} value={m.resourceType}>
                {m.resourceType}
              </option>
            ))}
          </select>
        </div>

        {loading || !machine ? (
          <div className="py-12 text-center text-fg-muted">Laden...</div>
        ) : (
          <div className="space-y-6">
            {/* States */}
            <section className="rounded-xl border border-default bg-raised p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">States ({machine.states.length})</h2>
                <button
                  type="button"
                  onClick={addState}
                  className="text-xs text-brand-600 hover:underline"
                >
                  + Voeg state toe
                </button>
              </div>
              <div className="space-y-2">
                {machine.states.map((state, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-default bg-page p-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${COLOR_BADGES[state.color] ?? COLOR_BADGES.gray}`}>
                      {state.label || "?"}
                    </span>
                    <input
                      type="text"
                      value={state.slug}
                      onChange={(e) => updateState(i, { slug: e.target.value })}
                      placeholder="slug"
                      className="w-32 rounded border border-default bg-raised px-2 py-1 font-mono text-xs text-fg"
                    />
                    <input
                      type="text"
                      value={state.label}
                      onChange={(e) => updateState(i, { label: e.target.value })}
                      placeholder="Label"
                      className="flex-1 rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                    />
                    <select
                      value={state.color}
                      onChange={(e) => updateState(i, { color: e.target.value })}
                      className="rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                    >
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className={`inline-block h-4 w-4 rounded-full ${COLOR_SWATCHES[state.color]}`} />
                    <label className="flex items-center gap-1 text-xs text-fg-muted">
                      <input
                        type="checkbox"
                        checked={state.terminal ?? false}
                        onChange={(e) => updateState(i, { terminal: e.target.checked || undefined })}
                      />
                      terminal
                    </label>
                    <button
                      type="button"
                      onClick={() => removeState(i)}
                      className="text-xs text-coral-600 hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-fg-muted">Initiale state</label>
                <select
                  value={machine.initialState}
                  onChange={(e) => setMachine({ ...machine, initialState: e.target.value })}
                  className="rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                >
                  {machine.states.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* Transitions */}
            <section className="rounded-xl border border-default bg-raised p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">Transities ({machine.transitions.length})</h2>
                <button
                  type="button"
                  onClick={addTransition}
                  className="text-xs text-brand-600 hover:underline"
                >
                  + Voeg transitie toe
                </button>
              </div>
              <div className="space-y-2">
                {machine.transitions.map((t, i) => (
                  <div key={i} className="rounded-lg border border-default bg-page p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <select
                        value={t.from}
                        onChange={(e) => updateTransition(i, { from: e.target.value })}
                        className="rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                      >
                        {machine.states.map((s) => (
                          <option key={s.slug} value={s.slug}>{s.label}</option>
                        ))}
                      </select>
                      <span className="text-fg-subtle">→</span>
                      <select
                        value={t.to}
                        onChange={(e) => updateTransition(i, { to: e.target.value })}
                        className="rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                      >
                        {machine.states.map((s) => (
                          <option key={s.slug} value={s.slug}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTransition(i)}
                        className="ml-auto text-xs text-coral-600 hover:underline"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={t.label ?? ""}
                        onChange={(e) => updateTransition(i, { label: e.target.value })}
                        placeholder="Knop-label (optioneel)"
                        className="rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                      />
                      <select
                        value={t.requiredRole ?? ""}
                        onChange={(e) => updateTransition(i, { requiredRole: e.target.value || undefined })}
                        className="rounded border border-default bg-raised px-2 py-1 text-xs text-fg"
                      >
                        {AVAILABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{r === "" ? "— geen rol-check —" : r}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={t.guard ?? ""}
                        onChange={(e) => updateTransition(i, { guard: e.target.value || undefined })}
                        placeholder="Guard expr (optioneel)"
                        className="rounded border border-default bg-raised px-2 py-1 font-mono text-xs text-fg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={resetToDefaults}
                className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken"
              >
                Reset naar defaults
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {saving ? "Opslaan..." : "State-machine opslaan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
