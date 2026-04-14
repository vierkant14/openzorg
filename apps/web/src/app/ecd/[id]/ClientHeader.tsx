"use client";

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  active?: boolean;
}

function clientNaam(client: ClientResource): string {
  const n = client.name?.[0];
  if (n?.text) return n.text;
  const given = n?.given?.join(" ") ?? "";
  const family = n?.family ?? "";
  return `${given} ${family}`.trim() || "Onbekend";
}

function clientBsn(client: ClientResource): string {
  const bsn = client.identifier?.find(
    (i) => i.system === "http://fhir.nl/fhir/NamingSystem/bsn",
  );
  return bsn?.value ?? client.identifier?.[0]?.value ?? "-";
}

function geslachtLabel(gender?: string): string {
  switch (gender) {
    case "male":
      return "Man";
    case "female":
      return "Vrouw";
    case "other":
      return "Anders";
    default:
      return "Onbekend";
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface ClientHeaderProps {
  client: ClientResource;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  const clientnummer = client.identifier?.find(
    (i) => i.system === "https://openzorg.nl/NamingSystem/clientnummer",
  )?.value;

  return (
    <header className="rounded-lg border border-default bg-raised p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white border-2 border-default">
            {(client.name?.[0]?.given?.[0]?.[0] ?? "").toUpperCase()}
            {(client.name?.[0]?.family?.[0] ?? "").toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fg">{clientNaam(client)}</h1>
            {clientnummer && (
              <p className="text-body-sm font-mono text-brand-600 dark:text-brand-400 mt-0.5">
                {clientnummer}
              </p>
            )}
          </div>
        </div>
        {client.active === false && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-medium bg-coral-50 dark:bg-coral-950/20 text-coral-600">
            Inactief
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="font-medium text-fg-subtle">BSN</dt>
          <dd className="text-fg">{clientBsn(client)}</dd>
        </div>
        <div>
          <dt className="font-medium text-fg-subtle">Geboortedatum</dt>
          <dd className="text-fg">{formatDate(client.birthDate)}</dd>
        </div>
        <div>
          <dt className="font-medium text-fg-subtle">Geslacht</dt>
          <dd className="text-fg">{geslachtLabel(client.gender)}</dd>
        </div>
      </dl>
    </header>
  );
}

export type { ClientResource };
