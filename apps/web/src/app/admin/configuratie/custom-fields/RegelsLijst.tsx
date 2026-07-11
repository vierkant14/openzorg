"use client";

import { EmptyState } from "@openzorg/shared-ui";

import type { ValidationRule } from "./types";

interface RegelsLijstProps {
  regels: ValidationRule[];
  onVerwijder: (id: string) => void;
}

/** Tabelweergave van de bestaande validatieregels, met verwijder-actie. */
export function RegelsLijst({ regels, onVerwijder }: RegelsLijstProps) {
  if (regels.length === 0) {
    return (
      <EmptyState
        titel="Nog geen validatieregels"
        uitleg="Voeg hieronder een regel toe om invoer per resourcetype te controleren."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-fg-subtle">
            <th className="pb-2 pr-4 font-medium">Resource</th>
            <th className="pb-2 pr-4 font-medium">Veldpad</th>
            <th className="pb-2 pr-4 font-medium">Operator</th>
            <th className="pb-2 pr-4 font-medium">Waarde</th>
            <th className="pb-2 pr-4 font-medium">Foutmelding</th>
            <th className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {regels.map((regel) => (
            <tr key={regel.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{regel.resourceType}</td>
              <td className="py-2 pr-4 font-mono text-xs">{regel.fieldPath}</td>
              <td className="py-2 pr-4">{regel.operator}</td>
              <td className="py-2 pr-4 font-mono text-xs">{regel.value}</td>
              <td className="py-2 pr-4 text-xs text-fg-subtle">{regel.errorMessage}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onVerwijder(regel.id)}
                  className="text-sm text-coral-600 hover:text-coral-800 font-medium"
                >
                  Verwijderen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
