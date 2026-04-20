"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface BezettingsGap {
  afdeling: string;
  afdelingId: string;
  dag: string;
  dienst: string;
  vereist: number;
  ingepland: number;
  medewerkers?: string[];
}

interface OptimalisatieSuggestie {
  afdelingId: string;
  dag: string;
  dienst: string;
  medewerkerId: string;
  medewerkerNaam: string;
  reden: string;
}

interface GenereerResultaat {
  toewijzingen: Array<{ afdelingId: string; dag: string; dienst: string; medewerkerId: string }>;
  onoplosbaar: Array<{ afdelingId: string; dag: string; dienst: string; reden: string }>;
}

interface Diensttype {
  code: string;
  naam: string;
  startTijd: string;
  eindTijd: string;
}

interface BezettingsEis {
  afdelingId: string;
  dienstCode: string;
  minimum: number;
}

interface Organization {
  id: string;
  resourceType: "Organization";
  name?: string;
  type?: Array<{ coding?: Array<{ code?: string }> }>;
  partOf?: { reference?: string };
}

interface OrganizationBundle {
  entry?: Array<{ resource: Organization }>;
}

interface CellData {
  ingepland: number;
  vereist: number;
  medewerkers: string[];
}

interface SelectedCell {
  afdelingId: string;
  afdelingNaam: string;
  dag: string;
  dienst: string;
  data: CellData;
}

/* ---------- Helpers ---------- */

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

function getWeekDays(weekOffset: number): Date[] {
  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const WEEKDAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function getWeekLabel(days: Date[]): string {
  if (days.length === 0) return "";
  const weekStr = getISOWeek(days[0]!);
  const weekNum = weekStr.split("-W")[1];
  const year = days[0]!.getFullYear();
  return `Week ${weekNum}, ${year}`;
}

/* ---------- Page ---------- */

export default function BezettingsroosterPage() {
  const [locaties, setLocaties] = useState<Array<{ id: string; naam: string }>>([]);
  const [selectedLocatie, setSelectedLocatie] = useState<string>("");
  const [afdelingen, setAfdelingen] = useState<Array<{ id: string; naam: string }>>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [diensttypen, setDiensttypen] = useState<Diensttype[]>([]);
  const [bezettingsEisen, setBezettingsEisen] = useState<BezettingsEis[]>([]);
  const [gaps, setGaps] = useState<BezettingsGap[]>([]);
  const [suggesties, setSuggesties] = useState<OptimalisatieSuggestie[]>([]);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [optimaliseerLoading, setOptimaliseerLoading] = useState(false);
  const [genereerLoading, setGenereerLoading] = useState(false);
  const [genereerResultaat, setGenereerResultaat] = useState<GenereerResultaat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => getWeekLabel(weekDays), [weekDays]);
  const weekISO = useMemo(() => (weekDays.length > 0 ? getISOWeek(weekDays[0]!) : ""), [weekDays]);

  /* Load organizations */
  const loadOrganisaties = useCallback(async () => {
    const { data } = await ecdFetch<OrganizationBundle>("/api/organisatie?_count=100");
    const orgs = data?.entry?.map((e) => e.resource) ?? [];
    const locs = orgs
      .filter((o) => o.type?.some((t) => t.coding?.some((c) => c.code === "locatie")))
      .map((o) => ({ id: o.id, naam: o.name ?? "(onbekend)" }));

    setLocaties(locs);
    if (locs.length > 0 && !selectedLocatie) {
      setSelectedLocatie(locs[0]!.id);
    }

    return orgs;
  }, [selectedLocatie]);

  /* Load afdelingen for selected locatie */
  const loadAfdelingen = useCallback(async (orgs: Organization[], locatieId: string) => {
    const afd = orgs
      .filter((o) => o.partOf?.reference === `Organization/${locatieId}`)
      .map((o) => ({ id: o.id, naam: o.name ?? "(onbekend)" }));
    setAfdelingen(afd);
    return afd;
  }, []);

  /* Load dienst config */
  const loadDienstConfig = useCallback(async (orgId: string) => {
    const { data } = await planningFetch<{ diensttypen: Diensttype[] }>(
      `/api/dienst-config/${orgId}`,
    );
    const types = data?.diensttypen ?? [
      { code: "V", naam: "Vroeg", startTijd: "07:00", eindTijd: "15:00" },
      { code: "L", naam: "Laat", startTijd: "15:00", eindTijd: "23:00" },
      { code: "N", naam: "Nacht", startTijd: "23:00", eindTijd: "07:00" },
    ];
    setDiensttypen(types);
    return types;
  }, []);

  /* Load bezettingseisen */
  const loadBezettingsEisen = useCallback(async (orgId: string) => {
    const { data } = await planningFetch<{ eisen: BezettingsEis[] }>(
      `/api/bezetting/${orgId}`,
    );
    setBezettingsEisen(data?.eisen ?? []);
    return data?.eisen ?? [];
  }, []);

  /* Validate bezetting (get gaps) */
  const validateBezetting = useCallback(async (orgId: string, week: string) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await planningFetch<{ gaps: BezettingsGap[] }>(
      "/api/planning-engine/validate",
      {
        method: "POST",
        body: JSON.stringify({ orgId, week }),
      },
    );
    if (err) {
      setError(err);
      setGaps([]);
    } else {
      setGaps(data?.gaps ?? []);
    }
    setLoading(false);
  }, []);

  /* Optimaliseer */
  const handleOptimaliseer = useCallback(async () => {
    if (!selectedLocatie) return;
    setOptimaliseerLoading(true);
    const { data } = await planningFetch<{ suggesties: OptimalisatieSuggestie[] }>(
      "/api/planning-engine/optimaliseer",
      {
        method: "POST",
        body: JSON.stringify({ orgId: selectedLocatie, week: weekISO }),
      },
    );
    setSuggesties(data?.suggesties ?? []);
    setOptimaliseerLoading(false);
  }, [selectedLocatie, weekISO]);

  /* Genereer rooster */
  const handleGenereer = useCallback(async () => {
    if (!selectedLocatie) return;
    setGenereerLoading(true);
    const { data } = await planningFetch<GenereerResultaat>(
      "/api/planning-engine/genereer",
      {
        method: "POST",
        body: JSON.stringify({ orgId: selectedLocatie, week: weekISO }),
      },
    );
    setGenereerResultaat(data);
    setGenereerLoading(false);
    // Refresh gaps after generation
    await validateBezetting(selectedLocatie, weekISO);
  }, [selectedLocatie, weekISO, validateBezetting]);

  /* Initial load */
  useEffect(() => {
    void (async () => {
      const orgs = await loadOrganisaties();
      if (orgs.length > 0) {
        const firstLoc = orgs.find((o) => o.type?.some((t) => t.coding?.some((c) => c.code === "locatie")));
        if (firstLoc) {
          await loadAfdelingen(orgs, firstLoc.id);
          await loadDienstConfig(firstLoc.id);
          await loadBezettingsEisen(firstLoc.id);
          await validateBezetting(firstLoc.id, getISOWeek(getWeekDays(0)[0]!));
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reload on locatie or week change */
  useEffect(() => {
    if (!selectedLocatie) return;
    void (async () => {
      const { data } = await ecdFetch<OrganizationBundle>("/api/organisatie?_count=100");
      const orgs = data?.entry?.map((e) => e.resource) ?? [];
      await loadAfdelingen(orgs, selectedLocatie);
      await loadDienstConfig(selectedLocatie);
      await loadBezettingsEisen(selectedLocatie);
      await validateBezetting(selectedLocatie, weekISO);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocatie, weekISO]);

  /* Build grid data */
  const gridData = useMemo(() => {
    const map: Record<string, CellData> = {};

    // Initialize all cells from bezettingseisen
    for (const afd of afdelingen) {
      for (const day of weekDays) {
        for (const dienst of diensttypen) {
          const key = `${afd.id}|${formatDag(day)}|${dienst.code}`;
          const eis = bezettingsEisen.find(
            (e) => e.afdelingId === afd.id && e.dienstCode === dienst.code,
          );
          map[key] = { ingepland: eis?.minimum ?? 0, vereist: eis?.minimum ?? 0, medewerkers: [] };
        }
      }
    }

    // Apply gaps (gaps tell us what's missing)
    for (const gap of gaps) {
      const key = `${gap.afdelingId}|${gap.dag}|${gap.dienst}`;
      if (map[key]) {
        map[key] = {
          vereist: gap.vereist,
          ingepland: gap.ingepland,
          medewerkers: gap.medewerkers ?? [],
        };
      } else {
        map[key] = {
          vereist: gap.vereist,
          ingepland: gap.ingepland,
          medewerkers: gap.medewerkers ?? [],
        };
      }
    }

    return map;
  }, [afdelingen, weekDays, diensttypen, bezettingsEisen, gaps]);

  /* Cell color logic */
  function getCellColor(cell: CellData | undefined): string {
    if (!cell || cell.vereist === 0) return "bg-surface-100 dark:bg-surface-800";
    if (cell.ingepland >= cell.vereist) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (cell.ingepland > 0) return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-coral-100 dark:bg-coral-900/30";
  }

  function getCellTextColor(cell: CellData | undefined): string {
    if (!cell || cell.vereist === 0) return "text-fg-subtle";
    if (cell.ingepland >= cell.vereist) return "text-emerald-800 dark:text-emerald-200";
    if (cell.ingepland > 0) return "text-amber-800 dark:text-amber-200";
    return "text-coral-800 dark:text-coral-200";
  }

  /* Cell click */
  function handleCellClick(afdelingId: string, afdelingNaam: string, dag: string, dienst: string) {
    const key = `${afdelingId}|${dag}|${dienst}`;
    const data = gridData[key] ?? { ingepland: 0, vereist: 0, medewerkers: [] };
    setSelectedCell({ afdelingId, afdelingNaam, dag, dienst, data });
  }

  /* Suggesties filtered for selected cell */
  const cellSuggesties = useMemo(() => {
    if (!selectedCell) return [];
    return suggesties.filter(
      (s) =>
        s.afdelingId === selectedCell.afdelingId &&
        s.dag === selectedCell.dag &&
        s.dienst === selectedCell.dienst,
    );
  }, [suggesties, selectedCell]);

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Toolbar */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            {/* Locatie picker */}
            <select
              value={selectedLocatie}
              onChange={(e) => setSelectedLocatie(e.target.value)}
              className="rounded-lg border border-default bg-raised px-3 py-2 text-body-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {locaties.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.naam}
                </option>
              ))}
            </select>

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="rounded-lg border border-default bg-raised px-3 py-2 text-body-sm text-fg-muted hover:bg-sunken transition-colors"
              >
                &lt; Vorige
              </button>
              <span className="min-w-[140px] text-center text-body-sm font-medium text-fg">
                {weekLabel}
              </span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="rounded-lg border border-default bg-raised px-3 py-2 text-body-sm text-fg-muted hover:bg-sunken transition-colors"
              >
                Volgende &gt;
              </button>
            </div>

            {/* Action buttons */}
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleOptimaliseer}
                disabled={optimaliseerLoading || !selectedLocatie}
                className="rounded-lg bg-brand-500 px-4 py-2 text-body-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {optimaliseerLoading ? "Bezig..." : "Optimaliseer"}
              </button>
              <button
                onClick={handleGenereer}
                disabled={genereerLoading || !selectedLocatie}
                className="rounded-lg border border-brand-500 bg-raised px-4 py-2 text-body-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition-colors"
              >
                {genereerLoading ? "Bezig..." : "Genereer rooster"}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg border border-coral-200 bg-coral-50 dark:bg-coral-900/20 dark:border-coral-800 p-3 text-body-sm text-coral-700 dark:text-coral-300">
              {error}
            </div>
          )}

          {/* Genereer result */}
          {genereerResultaat && (
            <div className="mb-4 rounded-lg border border-default bg-raised p-3 text-body-sm">
              <p className="font-medium text-fg">
                Rooster gegenereerd: {genereerResultaat.toewijzingen.length} toewijzingen
                {genereerResultaat.onoplosbaar.length > 0 && (
                  <span className="text-coral-600 dark:text-coral-400">
                    {" "}| {genereerResultaat.onoplosbaar.length} onoplosbaar
                  </span>
                )}
              </p>
              <button
                onClick={() => setGenereerResultaat(null)}
                className="mt-1 text-caption text-fg-subtle hover:text-fg"
              >
                Sluiten
              </button>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
            </div>
          ) : afdelingen.length === 0 ? (
            <div className="text-center py-20 text-fg-muted">
              <p className="text-heading-sm">Geen afdelingen gevonden</p>
              <p className="mt-1 text-body-sm">Selecteer een locatie met afdelingen</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-default bg-raised">
              <table className="w-full border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="sticky left-0 z-10 bg-raised px-3 py-2 text-left text-caption font-semibold text-fg-muted">
                      Afdeling
                    </th>
                    {weekDays.map((day, dayIdx) => (
                      <th
                        key={formatDag(day)}
                        colSpan={diensttypen.length}
                        className="border-l border-default px-2 py-2 text-center text-caption font-semibold text-fg-muted"
                      >
                        <div>{WEEKDAG_KORT[dayIdx]}</div>
                        <div className="text-[10px] font-normal">{day.getDate()}/{day.getMonth() + 1}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-default">
                    <th className="sticky left-0 z-10 bg-raised px-3 py-1" />
                    {weekDays.map((day) =>
                      diensttypen.map((dienst) => (
                        <th
                          key={`${formatDag(day)}-${dienst.code}`}
                          className="border-l border-default px-1 py-1 text-center text-[10px] font-medium text-fg-subtle"
                        >
                          {dienst.code}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {afdelingen.map((afd) => (
                    <tr key={afd.id} className="border-b border-default last:border-b-0">
                      <td className="sticky left-0 z-10 bg-raised px-3 py-2 font-medium text-fg whitespace-nowrap">
                        {afd.naam}
                      </td>
                      {weekDays.map((day) =>
                        diensttypen.map((dienst) => {
                          const key = `${afd.id}|${formatDag(day)}|${dienst.code}`;
                          const cell = gridData[key];
                          const isSelected =
                            selectedCell?.afdelingId === afd.id &&
                            selectedCell?.dag === formatDag(day) &&
                            selectedCell?.dienst === dienst.code;
                          return (
                            <td
                              key={key}
                              onClick={() => handleCellClick(afd.id, afd.naam, formatDag(day), dienst.code)}
                              className={`
                                border-l border-default px-1 py-2 text-center cursor-pointer
                                transition-colors hover:opacity-80
                                ${getCellColor(cell)}
                                ${isSelected ? "ring-2 ring-brand-500 ring-inset" : ""}
                              `}
                            >
                              <span className={`text-xs font-medium ${getCellTextColor(cell)}`}>
                                {cell ? `${cell.ingepland}/${cell.vereist}` : "-"}
                              </span>
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-caption text-fg-muted">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300" />
              <span>Bezetting OK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300" />
              <span>Minimaal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-coral-100 dark:bg-coral-900/30 border border-coral-300" />
              <span>Kritiek</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-surface-100 dark:bg-surface-800 border border-surface-300" />
              <span>Geen eis</span>
            </div>
          </div>
        </div>

        {/* Detail panel (right side) */}
        {selectedCell && (
          <div className="w-80 shrink-0 border-l border-default bg-raised overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading-sm font-semibold text-fg">Detail</h3>
              <button
                onClick={() => setSelectedCell(null)}
                className="rounded-lg px-2 py-1 text-caption text-fg-muted hover:bg-sunken transition-colors"
              >
                Sluiten
              </button>
            </div>

            <div className="space-y-3 text-body-sm">
              <div>
                <span className="text-fg-muted">Afdeling:</span>{" "}
                <span className="font-medium text-fg">{selectedCell.afdelingNaam}</span>
              </div>
              <div>
                <span className="text-fg-muted">Dag:</span>{" "}
                <span className="font-medium text-fg">{selectedCell.dag}</span>
              </div>
              <div>
                <span className="text-fg-muted">Dienst:</span>{" "}
                <span className="font-medium text-fg">{selectedCell.dienst}</span>
              </div>
              <div>
                <span className="text-fg-muted">Bezetting:</span>{" "}
                <span className="font-medium text-fg">
                  {selectedCell.data.ingepland}/{selectedCell.data.vereist}
                </span>
              </div>
            </div>

            {/* Ingeplande medewerkers */}
            {selectedCell.data.medewerkers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-caption font-semibold text-fg-muted mb-2">Ingepland</h4>
                <ul className="space-y-1">
                  {selectedCell.data.medewerkers.map((m, i) => (
                    <li key={i} className="text-body-sm text-fg">{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gap info */}
            {selectedCell.data.ingepland < selectedCell.data.vereist && selectedCell.data.vereist > 0 && (
              <div className="mt-4 rounded-lg bg-coral-50 dark:bg-coral-900/20 p-3">
                <p className="text-body-sm font-medium text-coral-700 dark:text-coral-300">
                  Tekort: {selectedCell.data.vereist - selectedCell.data.ingepland} medewerker(s)
                </p>
              </div>
            )}

            {/* AI suggesties */}
            {cellSuggesties.length > 0 && (
              <div className="mt-4">
                <h4 className="text-caption font-semibold text-fg-muted mb-2">AI Suggesties</h4>
                <div className="space-y-2">
                  {cellSuggesties.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-default bg-page p-2"
                    >
                      <p className="text-body-sm font-medium text-fg">{s.medewerkerNaam}</p>
                      <p className="text-caption text-fg-muted">{s.reden}</p>
                      <button className="mt-1 rounded bg-brand-500 px-2 py-0.5 text-caption font-medium text-white hover:bg-brand-600 transition-colors">
                        + Inplannen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cellSuggesties.length === 0 && suggesties.length === 0 && (
              <div className="mt-4">
                <p className="text-caption text-fg-subtle">
                  Klik op &quot;Optimaliseer&quot; voor AI-suggesties
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
