"use client";

import { useState } from "react";

/* ── Wiki content sections ── */

interface WikiSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "introductie",
    title: "Introductie",
    content: (
      <div className="prose-section">
        <p>
          OpenZorg is een open-source modulair zorgplatform voor Nederlandse zorginstellingen.
          Het platform ondersteunt de volledige zorgketen: VVT, GGZ, GHZ, Ziekenhuizen, Jeugdzorg en meer.
        </p>
        <p>
          Het businessmodel is hosting: elke zorginstelling krijgt een eigen omgeving met
          hun eigen data, gebruikers en configuratie. Als platform-beheerder kun je via het
          Master Admin portaal nieuwe omgevingen aanmaken en beheren.
        </p>
        <h3>Kernprincipes</h3>
        <ul>
          <li><strong>FHIR-native</strong> — Alle zorgdata wordt opgeslagen als FHIR R4 resources via Medplum</li>
          <li><strong>Multi-tenant</strong> — Elke organisatie heeft een eigen afgeschermde omgeving</li>
          <li><strong>Nederlands</strong> — De volledige interface is in het Nederlands</li>
          <li><strong>Open source</strong> — Volledig transparant en aanpasbaar</li>
        </ul>
      </div>
    ),
  },
  {
    id: "architectuur",
    title: "Architectuur",
    content: (
      <div className="prose-section">
        <h3>Services overzicht</h3>
        <table>
          <thead>
            <tr><th>Service</th><th>Poort</th><th>Technologie</th><th>Functie</th></tr>
          </thead>
          <tbody>
            <tr><td>Web</td><td>3000</td><td>Next.js 15</td><td>Frontend + API proxy</td></tr>
            <tr><td>ECD</td><td>4001</td><td>Hono</td><td>Clientdossier backend</td></tr>
            <tr><td>Planning</td><td>4002</td><td>Hono</td><td>Roosters, afspraken</td></tr>
            <tr><td>Workflow Bridge</td><td>4003</td><td>Hono</td><td>BPMN processen</td></tr>
            <tr><td>Medplum</td><td>8103</td><td>Medplum Server</td><td>FHIR R4 datastore</td></tr>
            <tr><td>Flowable</td><td>8080</td><td>Flowable REST</td><td>BPMN engine</td></tr>
            <tr><td>PostgreSQL</td><td>5432</td><td>PostgreSQL 16</td><td>Database</td></tr>
            <tr><td>Redis</td><td>6379</td><td>Redis 7</td><td>Cache / queue</td></tr>
          </tbody>
        </table>

        <h3>Dataflow</h3>
        <p>
          Browser → Next.js (proxy) → Hono service → Medplum FHIR R4 → PostgreSQL.
          Authenticatie gaat via Medplum PKCE tokens. Elke API-call stuurt een Bearer token
          en X-Tenant-ID header mee.
        </p>

        <h3>Multi-tenant isolatie</h3>
        <ul>
          <li><strong>Medplum Projects</strong> — Elke tenant heeft een eigen Medplum project met eigen data</li>
          <li><strong>PostgreSQL RLS</strong> — Row Level Security op tenant-specifieke tabellen</li>
          <li><strong>Middleware chain</strong> — Tenant → RBAC → Audit op elke API route</li>
        </ul>
      </div>
    ),
  },
  {
    id: "onboarding",
    title: "Nieuwe omgeving aanmaken",
    content: (
      <div className="prose-section">
        <p>Via het Master Admin portaal kun je nieuwe omgevingen aanmaken:</p>
        <ol>
          <li><strong>Organisatie</strong> — Naam, URL-slug en zorgsectoren invoeren</li>
          <li><strong>Contactpersoon</strong> — Aanspreekpunt voor de organisatie</li>
          <li><strong>Modules</strong> — Kies welke modules actief moeten zijn (kernmodules zijn verplicht)</li>
          <li><strong>Beheerder</strong> — Maak het eerste admin-account aan (e-mail + wachtwoord)</li>
          <li><strong>Bevestiging</strong> — De omgeving wordt aangemaakt inclusief Medplum project</li>
        </ol>
        <p>
          Na het aanmaken krijg je de inloggegevens te zien. Deel deze met de beheerder van de
          organisatie. Zij kunnen vervolgens zelf medewerkers toevoegen.
        </p>
      </div>
    ),
  },
  {
    id: "rollen",
    title: "Rollen & rechten",
    content: (
      <div className="prose-section">
        <p>OpenZorg heeft 4 rollen met elk hun eigen rechten:</p>
        <table>
          <thead>
            <tr><th>Rol</th><th>Omschrijving</th><th>Rechten</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Beheerder</strong></td>
              <td>Organisatie-admin</td>
              <td>Volledige toegang: configuratie, medewerkers, rollen, alle modules</td>
            </tr>
            <tr>
              <td><strong>Zorgmedewerker</strong></td>
              <td>Verpleegkundige, verzorgende</td>
              <td>Clienten, zorgplannen, rapportages, medicatie — geen configuratie</td>
            </tr>
            <tr>
              <td><strong>Teamleider</strong></td>
              <td>Afdelingshoofd</td>
              <td>Alles van zorgmedewerker + medewerkers, MIC-meldingen, workflows</td>
            </tr>
            <tr>
              <td><strong>Planner</strong></td>
              <td>Roostermaker</td>
              <td>Planning, roosters, beschikbaarheid, wachtlijst — beperkt clienttoegang</td>
            </tr>
          </tbody>
        </table>
        <p>
          De RBAC middleware controleert bij elke API-call of de gebruiker de juiste permissie
          heeft. Bij onvoldoende rechten wordt een 403-fout getoond.
        </p>
      </div>
    ),
  },
  {
    id: "modules",
    title: "Modules overzicht",
    content: (
      <div className="prose-section">
        <h3>Kernmodules (altijd actief)</h3>
        <ul>
          <li><strong>Clientregistratie</strong> — FHIR Patient resources, BSN-validatie, clientnummer</li>
          <li><strong>Medewerkers</strong> — FHIR Practitioner, AGB-registratie</li>
          <li><strong>Organisatie</strong> — Organization hierarchy, locaties, afdelingen</li>
          <li><strong>Rapportage</strong> — SOEP en vrije rapportages (Observation)</li>
          <li><strong>Planning</strong> — Afspraken, beschikbaarheid, dagplanning</li>
          <li><strong>Configuratie</strong> — Custom velden, validatieregels per tenant</li>
          <li><strong>Toegangsbeheer</strong> — RBAC, 4 rollen, 27 permissies</li>
          <li><strong>Berichten</strong> — Interne communicatie (Communication)</li>
        </ul>

        <h3>VVT-modules (optioneel)</h3>
        <ul>
          <li><strong>Zorgplan</strong> — CarePlan + Goal + ServiceRequest, leefgebieden</li>
          <li><strong>Medicatie</strong> — MedicationRequest + toedienregistratie</li>
          <li><strong>MIC-meldingen</strong> — Incident reporting (AuditEvent)</li>
          <li><strong>Vragenlijsten</strong> — Configureerbare screenings (Questionnaire)</li>
          <li><strong>MDO</strong> — Multidisciplinair overleg (Encounter)</li>
          <li><strong>VBM</strong> — Vrijheidsbeperkende maatregelen, Wvggz/Wzd (Procedure)</li>
          <li><strong>Toediening</strong> — Medicatietoediening registratie</li>
        </ul>
      </div>
    ),
  },
  {
    id: "fhir",
    title: "FHIR resource mapping",
    content: (
      <div className="prose-section">
        <p>Alle zorgdata wordt opgeslagen als standaard FHIR R4 resources:</p>
        <table>
          <thead>
            <tr><th>Nederlands</th><th>FHIR Resource</th><th>API Route</th></tr>
          </thead>
          <tbody>
            <tr><td>Client</td><td>Patient</td><td>/api/clients</td></tr>
            <tr><td>Contactpersoon</td><td>RelatedPerson</td><td>/api/clients/:id/contactpersonen</td></tr>
            <tr><td>Zorgplan</td><td>CarePlan + Goal</td><td>/api/clients/:id/zorgplan</td></tr>
            <tr><td>Rapportage</td><td>Observation</td><td>/api/clients/:id/rapportages</td></tr>
            <tr><td>Medicatie</td><td>MedicationRequest</td><td>/api/clients/:id/medicatie</td></tr>
            <tr><td>Toediening</td><td>MedicationAdministration</td><td>/api/clients/:id/toediening</td></tr>
            <tr><td>Allergie</td><td>AllergyIntolerance</td><td>/api/clients/:id/allergieen</td></tr>
            <tr><td>Diagnose</td><td>Condition</td><td>/api/clients/:id/diagnoses</td></tr>
            <tr><td>Screening</td><td>RiskAssessment</td><td>/api/clients/:id/risicoscreenings</td></tr>
            <tr><td>MDO</td><td>Encounter</td><td>/api/clients/:id/mdo</td></tr>
            <tr><td>VBM</td><td>Procedure</td><td>/api/clients/:id/vbm</td></tr>
            <tr><td>MIC-melding</td><td>AuditEvent</td><td>/api/mic-meldingen</td></tr>
            <tr><td>Medewerker</td><td>Practitioner</td><td>/api/medewerkers</td></tr>
            <tr><td>Organisatie</td><td>Organization</td><td>/api/organisatie</td></tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "deployment",
    title: "Deployment",
    content: (
      <div className="prose-section">
        <h3>Docker Compose (Unraid / lokaal)</h3>
        <p>De volledige stack draait via Docker Compose met 9 services:</p>
        <pre><code>{`# Start alles
docker compose -f infra/compose/docker-compose.yml up -d

# Rebuild na code-wijzigingen
docker compose -f infra/compose/docker-compose.yml up -d --build web ecd

# Seed (testgebruikers aanmaken)
docker compose -f infra/compose/docker-compose.yml up seed

# Logs bekijken
docker compose -f infra/compose/docker-compose.yml logs -f web ecd`}</code></pre>

        <h3>Eerste keer opstarten</h3>
        <ol>
          <li>Medplum draait 75+ database migraties bij eerste start (kan 30-60 min duren op HDD)</li>
          <li>Healthcheck is geconfigureerd met 300s start_period en 40 retries</li>
          <li>Andere services wachten automatisch op Medplum</li>
          <li>Na Medplum healthy: seed container maakt testgebruikers aan</li>
        </ol>

        <h3>Poorten</h3>
        <p>Standaard poorten: Web (3000), ECD (4001), Planning (4002), Workflow (4003), Medplum (8103), Flowable (8080), PostgreSQL (5432), Redis (6379).</p>
      </div>
    ),
  },
  {
    id: "api",
    title: "API documentatie",
    content: (
      <div className="prose-section">
        <h3>Authenticatie</h3>
        <p>Alle API-calls vereisen:</p>
        <ul>
          <li><code>Authorization: Bearer &lt;medplum-token&gt;</code> — Medplum PKCE access token</li>
          <li><code>X-Tenant-ID: &lt;project-id&gt;</code> — Medplum project ID van de tenant</li>
          <li><code>X-User-Role: &lt;rol&gt;</code> — beheerder / zorgmedewerker / teamleider / planner</li>
        </ul>

        <h3>Master Admin API</h3>
        <p>Vereist <code>X-Master-Key</code> header in plaats van tenant context:</p>
        <ul>
          <li><code>GET /api/master/tenants</code> — Lijst alle tenants</li>
          <li><code>POST /api/master/tenants</code> — Nieuwe tenant aanmaken</li>
          <li><code>POST /api/master/tenants/:id/provision</code> — Medplum project + admin aanmaken</li>
          <li><code>PUT /api/master/tenants/:id</code> — Tenant bijwerken</li>
          <li><code>DELETE /api/master/tenants/:id</code> — Tenant deactiveren</li>
        </ul>

        <h3>Response formaat</h3>
        <p>
          Succesvolle responses bevatten direct de FHIR resource of een JSON object.
          Fouten volgen het FHIR OperationOutcome formaat met <code>issue[].diagnostics</code>.
        </p>
      </div>
    ),
  },
];

/* ── Wiki page ── */

export default function WikiPage() {
  const [activeSection, setActiveSection] = useState("introductie");

  const section = WIKI_SECTIONS.find((s) => s.id === activeSection) ?? WIKI_SECTIONS[0];

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6">
          <div className="flex items-center gap-4">
            <a href="/master-admin" className="text-navy-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            <div>
              <h1 className="font-display text-heading font-bold tracking-tight">Wiki</h1>
              <p className="text-body-sm text-navy-300">Platform documentatie</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-8 space-y-1">
              {WIKI_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`block w-full text-left px-3 py-2 rounded-xl text-body-sm transition-colors ${
                    activeSection === s.id
                      ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-semibold"
                      : "text-fg-muted hover:text-fg hover:bg-sunken"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </nav>

          {/* Mobile nav */}
          <div className="lg:hidden w-full mb-6">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg"
            >
              {WIKI_SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-raised rounded-2xl border border-default p-8 shadow-soft">
              <h2 className="text-display-md text-fg font-display mb-6">{section?.title}</h2>
              <div className="wiki-content text-body-sm text-fg leading-relaxed">
                {section?.content}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped wiki styles */}
      <style>{`
        .wiki-content h3 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          color: var(--color-text-fg);
        }
        .wiki-content p {
          margin-bottom: 0.75rem;
        }
        .wiki-content ul, .wiki-content ol {
          margin-bottom: 0.75rem;
          padding-left: 1.5rem;
        }
        .wiki-content ul { list-style-type: disc; }
        .wiki-content ol { list-style-type: decimal; }
        .wiki-content li {
          margin-bottom: 0.375rem;
          color: var(--color-text-fg-muted);
        }
        .wiki-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
          font-size: 0.8125rem;
        }
        .wiki-content th {
          text-align: left;
          padding: 0.625rem 0.75rem;
          font-weight: 600;
          color: var(--color-text-fg-subtle);
          text-transform: uppercase;
          font-size: 0.6875rem;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--color-border-default);
        }
        .wiki-content td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--color-border-subtle);
          color: var(--color-text-fg-muted);
        }
        .wiki-content code {
          background: var(--color-bg-sunken);
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-family: var(--font-mono);
          font-size: 0.8125rem;
        }
        .wiki-content pre {
          background: var(--color-bg-sunken);
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .wiki-content pre code {
          background: none;
          padding: 0;
          font-size: 0.8125rem;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
