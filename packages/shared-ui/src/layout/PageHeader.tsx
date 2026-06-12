interface PageHeaderProps {
  titel: string;
  omschrijving?: string;
  children?: React.ReactNode;
}

/** Standaard paginakop: één h1 per pagina, acties rechts. */
export function PageHeader({ titel, omschrijving, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-fg">{titel}</h1>
        {omschrijving && <p className="mt-1 text-sm text-fg-muted">{omschrijving}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
