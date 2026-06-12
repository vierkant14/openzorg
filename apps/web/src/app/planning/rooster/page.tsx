"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import type { FhirAppointment } from "../../../components/planning/AfspraakBlock";
import { RoosterGrid } from "../../../components/planning/RoosterGrid";
import { RoosterToolbar } from "../../../components/planning/RoosterToolbar";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface Practitioner {
  id: string;
  resourceType: "Practitioner";
  name?: Array<{ family?: string; given?: string[] }>;
  active?: boolean;
}

interface PractitionerBundle {
  entry?: Array<{ resource: Practitioner }>;
}

interface AppointmentBundle {
  entry?: Array<{ resource: FhirAppointment }>;
}

interface ContractInfo {
  medewerkerId: string;
  urenPerWeek: number;
  contractType: string;
}

interface ContractsResponse {
  contracts: ContractInfo[];
}

/* ---------- Helpers ---------- */

function getNaam(p: Practitioner): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

function getWeekDays(startDate: Date): Date[] {
  const monday = new Date(startDate);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(days: Date[]): string {
  if (days.length === 0) return "";
  const first = days[0]!;
  const last = days[6]!;
  const optFirst: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const optLast: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return `${first.toLocaleDateString("nl-NL", optFirst)} — ${last.toLocaleDateString("nl-NL", optLast)}`;
}

/* ---------- Page ---------- */

export default function RoosterPage() {
  const [practitioners, setPractitioners] = useState<Array<{ id: string; naam: string }>>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [afsprakenMap, setAfsprakenMap] = useState<Record<string, FhirAppointment[]>>({});
  const [contractMap, setContractMap] = useState<Record<string, ContractInfo>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const loadPractitioners = useCallback(async () => {
    const { data, error: err, status } = await ecdFetch<PractitionerBundle>(
      "/api/medewerkers?_count=50&_sort=name",
    );
    if (err) {
      setError(status === 0 ? err : null);
      if (status === 0) return [];
    }
    const pracs = (data?.entry?.map((e) => e.resource) ?? [])
      .filter((p) => p.active !== false)
      .map((p) => ({ id: p.id, naam: getNaam(p) }));
    setPractitioners(pracs);
    return pracs;
  }, []);

  const loadContracts = useCallback(async (pracIds: string[]) => {
    if (pracIds.length === 0) return;
    const { data } = await planningFetch<ContractsResponse>(
      `/api/medewerkers/contracts?ids=${pracIds.join(",")}`,
    );
    if (data?.contracts) {
      const map: Record<string, ContractInfo> = {};
      for (const c of data.contracts) {
        map[c.medewerkerId] = c;
      }
      setContractMap(map);
    }
  }, []);

  const loadAfspraken = useCallback(async (days: Date[], pracs: Array<{ id: string }>) => {
    if (days.length === 0 || pracs.length === 0) return;
    const weekStart = dateString(days[0]!);
    const weekEnd = dateString(days[6]!);

    const { data } = await planningFetch<AppointmentBundle>(
      `/api/afspraken?date=ge${weekStart}&date=le${weekEnd}&_count=500`,
    );

    const map: Record<string, FhirAppointment[]> = {};
    // Initialize all practitioners with empty arrays
    for (const prac of pracs) {
      map[prac.id] = [];
    }

    if (data?.entry) {
      for (const entry of data.entry) {
        const appt = entry.resource;
        if (!appt.start) continue;

        const pracRef = appt.participant?.find((p) =>
          p.actor?.reference?.startsWith("Practitioner/"),
        )?.actor?.reference;

        if (pracRef) {
          const pracId = pracRef.replace("Practitioner/", "");
          if (!map[pracId]) map[pracId] = [];
          map[pracId]!.push(appt);
        }
      }
    }

    setAfsprakenMap(map);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const pracs = await loadPractitioners();
      if (pracs.length > 0) {
        await Promise.all([
          loadAfspraken(weekDays, pracs),
          loadContracts(pracs.map((p) => p.id)),
        ]);
      }

      setLoading(false);
    })();
  }, [weekOffset, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const weekLabel = formatWeekLabel(weekDays);

  return (
    <AppShell>
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <RoosterToolbar
          weekOffset={weekOffset}
          onPrevWeek={() => setWeekOffset((w) => w - 1)}
          onNextWeek={() => setWeekOffset((w) => w + 1)}
          onToday={() => setWeekOffset(0)}
          weekLabel={weekLabel}
        />

        {error && (
          <div className="p-3 bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 rounded-xl text-coral-600 dark:text-coral-400 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-sm text-fg-muted">Rooster laden...</p>
            </div>
          </div>
        ) : practitioners.length === 0 ? (
          <div className="text-center py-24">
            <h3 className="text-lg font-semibold text-fg">Geen medewerkers</h3>
            <p className="text-sm text-fg-muted mt-1">
              Voeg eerst medewerkers toe via Beheer &gt; Medewerkers.
            </p>
          </div>
        ) : (
          <RoosterGrid
            practitioners={practitioners}
            afsprakenMap={afsprakenMap}
            contractMap={contractMap}
            weekDays={weekDays}
            onAfspraakMoved={handleRefresh}
            onAfspraakCreated={handleRefresh}
          />
        )}
      </main>
    </AppShell>
  );
}
