"use client";

import { EmptyState } from "@openzorg/shared-ui";

import type { CustomField } from "./types";

interface VeldenLijstProps {
  velden: CustomField[];
  onToggle: (id: string, actief: boolean) => void;
  onVerwijder: (id: string) => void;
}

/**
 * Tabelweergave van de bestaande custom velden, met acties om een veld
 * aan of uit te zetten en te verwijderen.
 */
export function VeldenLijst({ velden, onToggle, onVerwijder }: VeldenLijstProps) {
  if (velden.length === 0) {
    return (
      <EmptyState
        titel="Nog geen custom velden"
        uitleg="Voeg hieronder een veld toe om extra gegevens per resourcetype vast te leggen."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-fg-subtle">
            <th className="pb-2 pr-4 font-medium">Resource</th>
            <th className="pb-2 pr-4 font-medium">Veldnaam</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Opties</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {velden.map((veld) => {
            const isActief = veld.active !== false;
            return (
              <tr
                key={veld.id}
                className={`border-b last:border-0 ${!isActief ? "opacity-50" : ""}`}
              >
                <td className="py-2 pr-4">{veld.resourceType}</td>
                <td className="py-2 pr-4 font-mono text-xs">{veld.fieldName}</td>
                <td className="py-2 pr-4">{veld.fieldType}</td>
                <td className="py-2 pr-4 text-xs text-fg-subtle">
                  {veld.options && veld.options.length > 0 ? (
                    veld.options.join(", ")
                  ) : (
                    <span className="text-fg-subtle">&mdash;</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      isActief
                        ? "bg-brand-50 text-brand-700"
                        : "bg-surface-100 text-fg-subtle dark:bg-surface-800"
                    }`}
                  >
                    {isActief ? "Actief" : "Inactief"}
                  </span>
                </td>
                <td className="py-2 text-right space-x-3">
                  <button
                    type="button"
                    onClick={() => onToggle(veld.id, isActief)}
                    className="text-sm text-brand-700 hover:text-brand-900 font-medium"
                  >
                    {isActief ? "Uitzetten" : "Aanzetten"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onVerwijder(veld.id)}
                    className="text-sm text-coral-600 hover:text-coral-800 font-medium"
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
