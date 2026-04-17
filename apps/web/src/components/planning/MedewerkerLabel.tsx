"use client";

interface MedewerkerLabelProps {
  naam: string;
  geplandUren: number;
  contractUren: number;
  contractOnbekend: boolean;
}

export function MedewerkerLabel({
  naam,
  geplandUren,
  contractUren,
  contractOnbekend,
}: MedewerkerLabelProps) {
  const percentage = contractUren > 0 ? (geplandUren / contractUren) * 100 : 0;
  const clampedWidth = Math.min(percentage, 100);

  let barColor = "bg-brand-500";
  if (percentage > 110) {
    barColor = "bg-coral-600";
  } else if (percentage > 100) {
    barColor = "bg-coral-400";
  } else if (percentage > 90) {
    barColor = "bg-yellow-500";
  }

  return (
    <div className="flex flex-col gap-1 min-w-[160px] py-1">
      <span className="text-sm font-medium text-fg truncate">{naam}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 rounded-full bg-sunken overflow-hidden max-w-[100px]"
          title={
            contractOnbekend
              ? `${geplandUren.toFixed(1)} uur gepland (contract onbekend)`
              : `${geplandUren.toFixed(1)} van ${contractUren.toFixed(1)} uur gepland deze week (${percentage.toFixed(0)}%)`
          }
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${clampedWidth}%` }}
          />
        </div>
        <span className="text-[11px] text-fg-muted whitespace-nowrap">
          {geplandUren.toFixed(0)}/{contractOnbekend ? "?" : contractUren.toFixed(0)}u
        </span>
      </div>
      {contractOnbekend && (
        <span className="text-[10px] text-fg-subtle italic">contract onbekend</span>
      )}
    </div>
  );
}
