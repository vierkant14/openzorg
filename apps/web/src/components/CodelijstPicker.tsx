"use client";

import { useEffect, useRef, useState } from "react";

import { ecdFetch } from "../lib/api";

interface CodelijstItem {
  code: string;
  display: string;
  system?: string;
}

interface CodelijstPickerProps {
  /** Codelijst type (zie services/ecd/src/routes/codelijsten.ts CODELIJST_TYPES) */
  type: "diagnoses" | "allergieen" | "medicatie" | "verrichtingen" | "observaties" | "lichaamsdelen" | "wondtypen" | "hulpmiddelen" | "voeding";
  /** Huidige waarde (display tekst) */
  value: string;
  /** Callback wanneer gebruiker een item kiest (of leeg maakt) */
  onChange: (display: string, code?: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Zoekveld met autocomplete voor codelijsten.
 *
 * Eerst toont het de tenant's curated lijst. Als de gebruiker iets typt
 * dat niet matcht, wordt SNOMED live doorzocht. Bij selectie krijgt de
 * parent zowel de display-tekst als de SNOMED-code terug.
 *
 * Fallback: als er geen curated lijst is EN SNOMED niets vindt (of faalt),
 * mag de gebruiker vrije tekst intikken. Dat blijft leesbaar, maar verliest
 * de codering-garantie.
 */
export function CodelijstPicker({
  type,
  value,
  onChange,
  placeholder = "Begin te typen…",
  required,
  id,
  className = "",
}: CodelijstPickerProps) {
  const [query, setQuery] = useState(value);
  const [curated, setCurated] = useState<CodelijstItem[]>([]);
  const [snomedResults, setSnomedResults] = useState<CodelijstItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load curated list one time
  useEffect(() => {
    ecdFetch<{ items?: CodelijstItem[] }>(`/api/admin/codelijsten/${type}`).then(({ data }) => {
      setCurated(data?.items ?? []);
    });
  }, [type]);

  // Sync from parent
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Debounced SNOMED search when query doesn't match curated
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSnomedResults([]);
      return;
    }
    const curatedMatch = curated.filter((c) => c.display.toLowerCase().includes(query.toLowerCase()));
    if (curatedMatch.length > 0 && curatedMatch[0]!.display.toLowerCase() === query.toLowerCase()) {
      setSnomedResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await ecdFetch<{ results?: CodelijstItem[] }>(
        `/api/admin/codelijsten/snomed/search?q=${encodeURIComponent(query)}&type=${type}`,
      );
      setSnomedResults(data?.results ?? []);
      setSearching(false);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, curated, type]);

  const curatedFiltered = curated.filter((c) => c.display.toLowerCase().includes(query.toLowerCase()));
  const showSnomed = query.length >= 2 && curatedFiltered.length < 5;

  function select(item: CodelijstItem) {
    setQuery(item.display);
    onChange(item.display, item.code);
    setOpen(false);
  }

  const inputCls =
    "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-raised text-fg";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        value={query}
        required={required}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={inputCls}
        autoComplete="off"
      />
      {open && (curatedFiltered.length > 0 || showSnomed) && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-default bg-raised shadow-lg">
          {curatedFiltered.length > 0 && (
            <div>
              <div className="sticky top-0 bg-sunken px-3 py-1 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                Tenant-lijst
              </div>
              {curatedFiltered.slice(0, 10).map((item) => (
                <button
                  key={`c-${item.code}`}
                  type="button"
                  onClick={() => select(item)}
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sunken"
                >
                  <span className="text-fg">{item.display}</span>
                  <span className="text-xs text-fg-subtle font-mono">{item.code}</span>
                </button>
              ))}
            </div>
          )}
          {showSnomed && (
            <div>
              <div className="sticky top-0 bg-sunken px-3 py-1 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                SNOMED CT {searching && "(zoeken…)"}
              </div>
              {snomedResults.length === 0 && !searching && (
                <div className="px-3 py-2 text-xs text-fg-subtle italic">
                  Geen SNOMED-resultaten. Je kunt vrije tekst intikken als laatste optie.
                </div>
              )}
              {snomedResults.slice(0, 10).map((item) => (
                <button
                  key={`s-${item.code}`}
                  type="button"
                  onClick={() => select(item)}
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sunken"
                >
                  <span className="text-fg">{item.display}</span>
                  <span className="text-xs text-fg-subtle font-mono">SNOMED {item.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
