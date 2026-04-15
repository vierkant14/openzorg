"use client";

import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../lib/api";

interface Practitioner {
  id: string;
  resourceType: "Practitioner";
  active?: boolean;
  name?: Array<{ family?: string; given?: string[] }>;
  qualification?: Array<{ code?: { text?: string } }>;
}

interface PractitionerBundle {
  entry?: Array<{ resource: Practitioner }>;
}

interface PractitionerPickerProps {
  value: string;
  onChange: (value: string, displayName: string, reference: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Wanneer true: toon alleen display-text, geen input (read-only preview) */
  readOnly?: boolean;
}

function getFullName(p: Practitioner): string {
  const n = p.name?.[0];
  if (!n) return p.id;
  const given = n.given?.join(" ") ?? "";
  const family = n.family ?? "";
  return `${given} ${family}`.trim() || p.id;
}

function getKwalificatie(p: Practitioner): string {
  return p.qualification?.[0]?.code?.text ?? "";
}

/**
 * Zoekbare dropdown voor een Practitioner (medewerker). Resulteert in
 * een string-display-naam en een Practitioner-reference voor FHIR.
 *
 * Waarde kan zowel een id zijn als een vrije tekst (backwards-compat
 * met bestaande data). Bij mount wordt de Practitioner lijst gefetched
 * en als de waarde matcht een id, wordt de naam getoond.
 */
export function PractitionerPicker({
  value,
  onChange,
  placeholder = "Zoek een medewerker...",
  disabled,
  className = "",
  readOnly,
}: PractitionerPickerProps) {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [searchQuery, setSearchQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await ecdFetch<PractitionerBundle>("/api/medewerkers?_count=100");
    setPractitioners(data?.entry?.map((e) => e.resource) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

  const filtered = practitioners.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = getFullName(p).toLowerCase();
    return name.includes(q);
  });

  function selectPractitioner(p: Practitioner) {
    const displayName = getFullName(p);
    setSearchQuery(displayName);
    setIsOpen(false);
    onChange(p.id, displayName, `Practitioner/${p.id}`);
  }

  if (readOnly) {
    return <span className="text-sm text-fg">{value || "—"}</span>;
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setIsOpen(true);
          // Als de gebruiker vrije tekst typt, houd het nog steeds geldig
          // als fallback (geen match)
          onChange(e.target.value, e.target.value, "");
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-default bg-raised shadow-lg max-h-60 overflow-y-auto">
          {filtered.slice(0, 20).map((p) => {
            const name = getFullName(p);
            const kwal = getKwalificatie(p);
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPractitioner(p)}
                className="w-full border-b border-subtle last:border-0 px-3 py-2 text-left hover:bg-sunken"
              >
                <div className="text-sm font-medium text-fg">{name}</div>
                {kwal && <div className="text-xs text-fg-subtle">{kwal}</div>}
              </button>
            );
          })}
          {filtered.length > 20 && (
            <div className="px-3 py-1 text-xs text-fg-subtle text-center">
              {filtered.length - 20} meer — verfijn je zoekterm
            </div>
          )}
        </div>
      )}
    </div>
  );
}
