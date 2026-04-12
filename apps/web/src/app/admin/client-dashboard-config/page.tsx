"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { type WidgetConfig, loadWidgetConfig, saveWidgetConfig } from "../../../lib/widget-config";

/* -------------------------------------------------------------------------- */
/*  Admin page component                                                      */
/* -------------------------------------------------------------------------- */

export default function ClientDashboardConfigPage() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setWidgets(loadWidgetConfig());
  }, []);

  const toggle = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
    );
    setSaved(false);
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setWidgets((prev) => {
      const next = [...prev];
      const tmp = next[index - 1]!;
      next[index - 1] = next[index]!;
      next[index] = tmp;
      return next;
    });
    setSaved(false);
  }, []);

  const moveDown = useCallback((index: number) => {
    setWidgets((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const tmp = next[index + 1]!;
      next[index + 1] = next[index]!;
      next[index] = tmp;
      return next;
    });
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    saveWidgetConfig(widgets);
    setSaved(true);
  }, [widgets]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-fg">Client dashboard configuratie</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Bepaal welke widgets zichtbaar zijn op de startpagina van een client en in welke
          volgorde ze verschijnen.
        </p>

        <div className="mt-6 space-y-2">
          {widgets.map((widget, idx) => (
            <div
              key={widget.id}
              className="flex items-center gap-3 rounded-lg border border-default bg-raised px-4 py-3"
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggle(widget.id)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  widget.enabled ? "bg-brand-600" : "bg-surface-300 dark:bg-surface-700"
                }`}
                role="switch"
                aria-checked={widget.enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    widget.enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>

              {/* Label */}
              <span
                className={`flex-1 text-sm font-medium ${
                  widget.enabled ? "text-fg" : "text-fg-subtle"
                }`}
              >
                {widget.label}
              </span>

              {/* Reorder arrows */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="rounded p-1 text-fg-muted hover:bg-page disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Omhoog"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === widgets.length - 1}
                  className="rounded p-1 text-fg-muted hover:bg-page disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Omlaag"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Opslaan
          </button>
          {saved && (
            <span className="text-sm text-brand-600">Configuratie opgeslagen</span>
          )}
        </div>
      </div>
    </AppShell>
  );
}
