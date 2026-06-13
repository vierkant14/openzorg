interface EmptyStateProps {
  titel: string;
  uitleg?: string;
  actieLabel?: string;
  onActie?: () => void;
  icoon?: React.ReactNode;
}

/**
 * Lege staat die de interface uitlegt: wat hoort hier, en wat is de
 * eerstvolgende zinvolle actie. Warme, directe microcopy — geen "Geen data".
 */
export function EmptyState({ titel, uitleg, actieLabel, onActie, icoon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default bg-sunken px-6 py-10 text-center">
      {icoon && <div className="text-fg-subtle">{icoon}</div>}
      <p className="text-sm font-semibold text-fg">{titel}</p>
      {uitleg && <p className="max-w-sm text-sm text-fg-muted">{uitleg}</p>}
      {actieLabel && onActie && (
        <button
          type="button"
          onClick={onActie}
          className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {actieLabel}
        </button>
      )}
    </div>
  );
}
