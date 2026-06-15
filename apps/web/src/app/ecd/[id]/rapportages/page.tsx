"use client";

import { useParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { AiSamenvatting } from "./AiSamenvatting";
import { RapportageComposer } from "./RapportageComposer";
import { RapportageLijst } from "./RapportageLijst";
import {
  getGoalIdFromObservation,
  useRapportages,
  type FhirObservation,
} from "./useRapportages";

const filterCls =
  "rounded-lg border border-default bg-raised px-3 py-1.5 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

export default function RapportagesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const { items, goals, clientNaam, loading, error, reload } = useRapportages(clientId);

  const [filterType, setFilterType] = useState<"alle" | "soep" | "vrij">("alle");
  const [filterGoalId, setFilterGoalId] = useState<string>("alle");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id ?? "", g])), [goals]);

  const filteredItems = useMemo(
    () =>
      items.filter((obs: FhirObservation) => {
        const type = obs.code?.text?.toLowerCase() ?? "vrij";
        const isSoep = type === "soep";
        if (filterType === "soep" && !isSoep) return false;
        if (filterType === "vrij" && isSoep) return false;
        if (filterGoalId !== "alle") {
          const goalId = getGoalIdFromObservation(obs);
          if (filterGoalId === "geen" && goalId) return false;
          if (filterGoalId !== "geen" && goalId !== filterGoalId) return false;
        }
        const dt = obs.effectiveDateTime ?? "";
        if (filterDateFrom && dt < filterDateFrom) return false;
        if (filterDateTo && dt > filterDateTo + "T23:59:59") return false;
        if (searchText.trim()) {
          const q = searchText.toLowerCase();
          const allText = [
            obs.valueString ?? "",
            ...(obs.extension?.map((e) => e.valueString ?? "") ?? []),
          ]
            .join(" ")
            .toLowerCase();
          if (!allText.includes(q)) return false;
        }
        return true;
      }),
    [items, filterType, filterGoalId, filterDateFrom, filterDateTo, searchText],
  );

  const heeftActieveFilter =
    filterType !== "alle" ||
    filterGoalId !== "alle" ||
    Boolean(filterDateFrom) ||
    Boolean(filterDateTo) ||
    Boolean(searchText);

  function wisFilters() {
    setFilterType("alle");
    setFilterGoalId("alle");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchText("");
  }

  const filterId = useId();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">
          Rapportages
          <span className="ml-2 text-sm font-normal text-fg-subtle">
            ({filteredItems.length}
            {filteredItems.length !== items.length ? ` van ${items.length}` : ""})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium btn-press ${
              showFilters || heeftActieveFilter
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-950/20"
                : "border-default text-fg-muted hover:bg-sunken"
            }`}
          >
            Filteren
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken btn-press print:hidden"
            title="Rapportages afdrukken"
          >
            Afdrukken
          </button>
          <AiSamenvatting clientId={clientId} clientNaam={clientNaam} />
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-default bg-sunken p-3 animate-[fade-in_200ms_ease-out]">
          <div>
            <label htmlFor={`${filterId}-type`} className="mb-1 block text-xs font-medium text-fg-muted">Type</label>
            <select
              id={`${filterId}-type`}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "alle" | "soep" | "vrij")}
              className={filterCls}
            >
              <option value="alle">Alle</option>
              <option value="soep">SOEP</option>
              <option value="vrij">Vrij</option>
            </select>
          </div>
          {goals.length > 0 && (
            <div>
              <label htmlFor={`${filterId}-doel`} className="mb-1 block text-xs font-medium text-fg-muted">Doel</label>
              <select
                id={`${filterId}-doel`}
                value={filterGoalId}
                onChange={(e) => setFilterGoalId(e.target.value)}
                className={filterCls}
              >
                <option value="alle">Alle doelen</option>
                <option value="geen">Geen doel</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id ?? ""}>
                    {g.description?.text ?? "Doel"}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor={`${filterId}-van`} className="mb-1 block text-xs font-medium text-fg-muted">Van</label>
            <input
              id={`${filterId}-van`}
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className={filterCls}
            />
          </div>
          <div>
            <label htmlFor={`${filterId}-tot`} className="mb-1 block text-xs font-medium text-fg-muted">Tot</label>
            <input
              id={`${filterId}-tot`}
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className={filterCls}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor={`${filterId}-zoek`} className="mb-1 block text-xs font-medium text-fg-muted">Zoeken</label>
            <input
              id={`${filterId}-zoek`}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Zoek in rapportages..."
              className={`${filterCls} w-full`}
            />
          </div>
          {heeftActieveFilter && (
            <button
              onClick={wisFilters}
              className="pb-1.5 text-xs font-medium text-coral-600 hover:text-coral-800 btn-press"
            >
              Wissen
            </button>
          )}
        </div>
      )}

      <RapportageComposer clientId={clientId} goals={goals} onSaved={reload} />

      <RapportageLijst
        items={filteredItems}
        goalsById={goalsById}
        loading={loading}
        error={error}
        onRetry={reload}
        heeftActieveFilter={heeftActieveFilter}
        onWisFilters={wisFilters}
      />
    </section>
  );
}
