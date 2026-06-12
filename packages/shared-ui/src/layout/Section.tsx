interface SectionProps {
  titel: string;
  actie?: React.ReactNode;
  children: React.ReactNode;
}

/** Inhoudsblok met h2-kop; de bouwsteen van werkruimte-startpagina's. */
export function Section({ titel, actie, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-default bg-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{titel}</h2>
        {actie}
      </div>
      {children}
    </section>
  );
}
