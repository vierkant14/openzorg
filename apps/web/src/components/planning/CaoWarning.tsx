"use client";

import { useState } from "react";

import type { CaoViolation } from "../../lib/cao-engine";

interface CaoWarningProps {
  violations: CaoViolation[];
  overrides: Set<string>;
  onOverride: (violation: CaoViolation, reden: string) => void;
  onOverrideAll: (reden: string) => void;
}

export function CaoWarning({
  violations,
  overrides,
  onOverride,
  onOverrideAll,
}: CaoWarningProps) {
  const [redenMap, setRedenMap] = useState<Record<string, string>>({});
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [bulkReden, setBulkReden] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const activeViolations = violations.filter(
    (v) => !overrides.has(`${v.rule}:${v.practitionerId}`),
  );

  if (activeViolations.length === 0) return null;

  const overtredingen = activeViolations.filter((v) => v.severity === "error");
  const waarschuwingen = activeViolations.filter((v) => v.severity === "warning");

  function handleSubmitOverride(violation: CaoViolation) {
    const key = `${violation.rule}:${violation.practitionerId}`;
    const reden = redenMap[key] ?? "";
    if (reden.length < 10) return;
    onOverride(violation, reden);
    setOpenPopover(null);
  }

  function handleBulkOverride() {
    if (bulkReden.length < 10) return;
    onOverrideAll(bulkReden);
    setShowBulk(false);
    setBulkReden("");
  }

  const violationKey = (v: CaoViolation) => `${v.rule}:${v.practitionerId}`;

  return (
    <div className="sticky bottom-0 z-30 border-t-2 border-yellow-300 dark:border-yellow-700">
      <div className={`px-4 py-3 ${
        overtredingen.length > 0
          ? "bg-coral-50 dark:bg-coral-950/20 border-coral-300 dark:border-coral-700"
          : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700"
      }`}>
        <div className="flex items-start gap-3">
          {/* Warning icon */}
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">
              CAO-waarschuwing: {activeViolations.length} {activeViolations.length === 1 ? "melding" : "meldingen"} gevonden
            </p>

            <ul className="mt-2 space-y-2">
              {[...overtredingen, ...waarschuwingen].map((v) => {
                const key = violationKey(v);
                const isOpen = openPopover === key;

                return (
                  <li key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-fg-muted">
                      {v.message}
                      {v.severity === "error" && (
                        <span className="ml-1 text-[10px] font-semibold text-coral-600 dark:text-coral-400 uppercase">overtreding</span>
                      )}
                    </span>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenPopover(isOpen ? null : key)}
                        className="text-xs px-2 py-1 rounded-md bg-raised border border-default hover:bg-sunken transition-colors text-fg-muted"
                      >
                        Doorgaan met reden
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-72 bg-raised border border-default rounded-xl shadow-lg p-3 z-50">
                          <p className="text-xs text-fg-muted mb-2">Reden voor afwijking van CAO-norm:</p>
                          <textarea
                            value={redenMap[key] ?? ""}
                            onChange={(e) => setRedenMap((m) => ({ ...m, [key]: e.target.value }))}
                            placeholder="Bijv. spoedvervanger ivm ziekte collega..."
                            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-2 text-fg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-fg-subtle">
                              {(redenMap[key] ?? "").length}/10 min. tekens
                            </span>
                            <button
                              onClick={() => handleSubmitOverride(v)}
                              disabled={(redenMap[key] ?? "").length < 10}
                              className="text-xs px-3 py-1 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Bevestigen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {activeViolations.length > 1 && (
              <div className="mt-3 relative">
                <button
                  onClick={() => setShowBulk(!showBulk)}
                  className="text-xs px-3 py-1.5 rounded-md bg-raised border border-default hover:bg-sunken transition-colors text-fg-muted"
                >
                  Alles bevestigen
                </button>

                {showBulk && (
                  <div className="absolute left-0 bottom-full mb-2 w-80 bg-raised border border-default rounded-xl shadow-lg p-3 z-50">
                    <p className="text-xs text-fg-muted mb-2">
                      Reden voor afwijking van alle {activeViolations.length} CAO-normen:
                    </p>
                    <textarea
                      value={bulkReden}
                      onChange={(e) => setBulkReden(e.target.value)}
                      placeholder="Bijv. noodplanning door meerdere ziekmeldingen..."
                      className="w-full text-sm rounded-lg border border-default bg-page px-3 py-2 text-fg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-fg-subtle">
                        {bulkReden.length}/10 min. tekens
                      </span>
                      <button
                        onClick={handleBulkOverride}
                        disabled={bulkReden.length < 10}
                        className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Alles bevestigen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
