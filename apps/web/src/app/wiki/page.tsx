"use client";

import { useState } from "react";

import AppShell from "../../components/AppShell";

/* ── Wiki content sections ── */

interface WikiSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const WIKI_SECTIONS: WikiSection[] = [
  {
    id: "dashboard-config",
    title: "Client dashboard aanpassen",
    content: (
      <div className="prose-section">
        <p>
          Het clientoverzicht (de startpagina van een clientdossier) toont widgets met
          de belangrijkste informatie. Elke organisatie kan zelf kiezen welke widgets zichtbaar zijn.
        </p>
        <h3>Beschikbare widgets</h3>
        <ul>
          <li><strong>Persoonlijke gegevens</strong> — Naam, BSN, geboortedatum, adres</li>
          <li><strong>Zorgplan samenvatting</strong> — Actieve doelen en interventies</li>
          <li><strong>Laatste rapportages</strong> — De 3 meest recente rapportages</li>
          <li><strong>Medicatie</strong> — Actuele medicatievoorschriften</li>
          <li><strong>Allergie&euml;n</strong> — Geregistreerde allergie&euml;n met ernst</li>
          <li><strong>Vaccinaties</strong> — Recente vaccinaties met geldigheid</li>
          <li><strong>Contactpersonen</strong> — Eerste contactpersonen</li>
          <li><strong>Afspraken</strong> — Aankomende afspraken</li>
        </ul>
        <h3>Dashboard aanpassen</h3>
        <ol>
          <li>Ga naar <strong>Beheer &rarr; Client dashboard</strong></li>
          <li>Schakel widgets aan of uit met de toggles</li>
          <li>Gebruik de pijltjes om de volgorde te wijzigen</li>
          <li>Klik op <strong>Opslaan</strong></li>
        </ol>
        <p>
          De configuratie wordt opgeslagen per organisatie. Alle medewerkers binnen
          dezelfde organisatie zien dezelfde indeling.
        </p>
      </div>
    ),
  },
  {
    id: "vaccinaties",
    title: "Hoe werken vaccinaties",
    content: (
      <div className="prose-section">
        <p>
          Vaccinaties worden per client geregistreerd in het tabblad &ldquo;Vaccinaties&rdquo;
          van het clientdossier.
        </p>
        <h3>Eenmalig vs. herhalend</h3>
        <ul>
          <li>
            <strong>Eenmalige vaccinaties</strong> — Bijv. Pneumokokken, Zona. Worden eenmaal
            gegeven en hoeven niet herhaald te worden.
          </li>
          <li>
            <strong>Herhalende vaccinaties</strong> — Bijv. Griepprik (jaarlijks), COVID-19 booster.
            Het systeem toont wanneer de volgende vaccinatie nodig is.
          </li>
        </ul>
        <h3>Geldigheid (einddatum)</h3>
        <p>
          Bij elke vaccinatie kan een &ldquo;Geldig tot&rdquo; datum worden ingevuld. Dit geeft
          aan wanneer de vaccinatiebescherming verloopt. Verlopen vaccinaties worden rood
          gemarkeerd in het dossier.
        </p>
        <table>
          <thead>
            <tr><th>Vaccin</th><th>Geldigheid</th><th>Frequentie</th></tr>
          </thead>
          <tbody>
            <tr><td>Griep (Influenza)</td><td>~1 jaar</td><td>Jaarlijks</td></tr>
            <tr><td>COVID-19 booster</td><td>~1 jaar</td><td>Jaarlijks</td></tr>
            <tr><td>Tetanus</td><td>~10 jaar</td><td>Eenmalig</td></tr>
            <tr><td>Pneumokokken</td><td>Levenslang</td><td>Eenmalig</td></tr>
            <tr><td>Zona (gordelroos)</td><td>Levenslang</td><td>Eenmalig</td></tr>
          </tbody>
        </table>
        <h3>Vaccinatie registreren</h3>
        <ol>
          <li>Open het clientdossier en ga naar &ldquo;Vaccinaties&rdquo;</li>
          <li>Klik op &ldquo;+ Vaccinatie registreren&rdquo;</li>
          <li>Selecteer het vaccin of typ de naam handmatig</li>
          <li>Vul datum, lotnummer en locatie in</li>
          <li>Vink &ldquo;Herhalende vaccinatie&rdquo; aan indien van toepassing</li>
          <li>Stel de frequentie en volgende datum in</li>
          <li>Klik op &ldquo;Opslaan&rdquo;</li>
        </ol>
      </div>
    ),
  },
  {
    id: "workflows",
    title: "Hoe werken workflows",
    content: (
      <div className="prose-section">
        <p>
          Workflows zijn gestructureerde processen die stap-voor-stap doorlopen worden.
          Elke stap wordt toegewezen aan een rol (bijv. teamleider, zorgmedewerker).
        </p>
        <h3>Beschikbare processen</h3>
        <table>
          <thead>
            <tr><th>Workflow</th><th>Doel</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Intake Proces</strong></td><td>Nieuwe client: aanmelding beoordelen, intake plannen</td></tr>
            <tr><td><strong>Zorgplan Evaluatie</strong></td><td>Periodieke evaluatie: MDO plannen, doelen bijstellen</td></tr>
            <tr><td><strong>Herindicatie</strong></td><td>Indicatie verloopt: gegevens actualiseren, CIZ-aanvraag</td></tr>
            <tr><td><strong>MIC Afhandeling</strong></td><td>Incident: analyseren, maatregelen, evalueren</td></tr>
            <tr><td><strong>Vaccinatie Campagne</strong></td><td>Bulk vaccinatie: doelgroep selecteren, plannen, toedienen</td></tr>
          </tbody>
        </table>
        <h3>Hoe start ik een workflow?</h3>
        <ol>
          <li>Ga naar <strong>Beheer &rarr; Workflows</strong></li>
          <li>Deploy eerst het gewenste procestemplate</li>
          <li>Ga naar <strong>Lopende instanties</strong></li>
          <li>Klik op &ldquo;Nieuw proces starten&rdquo;</li>
          <li>Selecteer het proces en klik op &ldquo;Starten&rdquo;</li>
        </ol>
        <h3>Taken afhandelen</h3>
        <p>
          Wanneer een processtap aan jouw rol is toegewezen, verschijnt deze als taak
          in de werkbak. Open de taak, vul de benodigde informatie in, en rond af.
        </p>
        <h3>MIC Afhandeling voorbeeld</h3>
        <ol>
          <li><strong>Melding analyseren</strong> (teamleider) — Bepaal de ernst: laag of hoog</li>
          <li>Bij <em>laag</em>: Registreer maatregelen en sluit af</li>
          <li>Bij <em>hoog</em>: Verbetermaatregelen bepalen (beheerder) &rarr; Uitvoeren (zorgmedewerker) &rarr; Evalueren (teamleider)</li>
        </ol>
        <p>
          <strong>Tip:</strong> Bij de eerste stap van MIC Afhandeling vul je het
          veld <code>ernstNiveau</code> in met waarde <code>laag</code> of <code>hoog</code>.
        </p>
      </div>
    ),
  },
  {
    id: "codelijsten",
    title: "Hoe werken de codelijsten",
    content: (
      <div className="prose-section">
        <p>
          Codelijsten zijn gestandaardiseerde lijsten met veelvoorkomende waarden die in het
          systeem gebruikt worden. Denk aan diagnoses, allergenen, medicatie en verrichtingen.
        </p>
        <h3>Waarom codelijsten?</h3>
        <ul>
          <li>
            <strong>Uniformiteit</strong> — Alle medewerkers gebruiken dezelfde termen, wat
            misverstanden voorkomt
          </li>
          <li>
            <strong>Snelheid</strong> — Snel selecteren in plaats van vrij typen
          </li>
          <li>
            <strong>Rapportage</strong> — Gestandaardiseerde codes maken betrouwbare
            overzichten mogelijk
          </li>
        </ul>
        <h3>Beschikbare codelijsten</h3>
        <table>
          <thead>
            <tr>
              <th>Codelijst</th>
              <th>Gebruikt bij</th>
              <th>Voorbeeld</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Diagnoses</td>
              <td>Clientdossier</td>
              <td>Diabetes mellitus, Hypertensie, COPD</td>
            </tr>
            <tr>
              <td>Allergenen</td>
              <td>Allergie-registratie</td>
              <td>Penicilline, Latex, Noten</td>
            </tr>
            <tr>
              <td>Medicatie</td>
              <td>Medicatievoorschriften</td>
              <td>Metoprolol, Omeprazol, Paracetamol</td>
            </tr>
            <tr>
              <td>Verrichtingen</td>
              <td>Zorgactiviteiten</td>
              <td>Wondverzorging, Bloeddrukmeting</td>
            </tr>
          </tbody>
        </table>
        <h3>Hoe gebruik ik een codelijst?</h3>
        <ol>
          <li>Open het relevante formulier (bijv. nieuwe diagnose toevoegen)</li>
          <li>Begin te typen in het zoekveld — de lijst filtert automatisch</li>
          <li>Selecteer de juiste code uit de suggesties</li>
          <li>De code wordt gekoppeld aan het clientdossier</li>
        </ol>
        <p>
          Beheerders kunnen codelijsten aanpassen via{" "}
          <strong>Beheer &rarr; Codelijsten</strong>.
        </p>
        <h3>SNOMED CT en eigen termen</h3>
        <p>
          Veel termen komen uit SNOMED CT, het internationale medische terminologiestelsel.
          Maar niet alles staat in SNOMED — denk aan specifieke voedingsprotocollen, eigen
          hulpmiddelen of organisatie-specifieke verrichtingen. Daarom kun je naast SNOMED-termen
          ook <strong>eigen termen</strong> toevoegen via het formulier &ldquo;Eigen term
          toevoegen&rdquo; onderaan de zoekpagina.
        </p>
      </div>
    ),
  },
  {
    id: "zorgplan",
    title: "Hoe werkt het zorgplan",
    content: (
      <div className="prose-section">
        <p>
          Het zorgplan is het hart van de zorgverlening. Hierin staan de doelen van de client,
          de afgesproken acties en de evaluaties.
        </p>
        <h3>Opbouw van het zorgplan</h3>
        <ul>
          <li>
            <strong>Leefgebieden</strong> — Het zorgplan is ingedeeld per leefgebied
            (lichamelijk welbevinden, mobiliteit, persoonlijke verzorging, etc.)
          </li>
          <li>
            <strong>Doelen</strong> — Per leefgebied worden concrete, meetbare doelen
            opgesteld
          </li>
          <li>
            <strong>Acties</strong> — Bij elk doel horen acties die beschrijven wat er
            gedaan moet worden
          </li>
          <li>
            <strong>Evaluaties</strong> — Periodiek wordt beoordeeld of de doelen behaald
            worden
          </li>
        </ul>
        <h3>Workflow</h3>
        <ol>
          <li>
            <strong>Intake</strong> — Bij opname of start zorg wordt het eerste zorgplan
            opgesteld
          </li>
          <li>
            <strong>Doelen formuleren</strong> — Samen met de client worden de doelen
            bepaald
          </li>
          <li>
            <strong>Uitvoering</strong> — Medewerkers voeren de afgesproken zorg uit en
            rapporteren
          </li>
          <li>
            <strong>Evaluatie</strong> — Minimaal elke 6 maanden worden doelen geevalueerd
          </li>
          <li>
            <strong>Bijstelling</strong> — Op basis van de evaluatie wordt het plan
            aangepast
          </li>
        </ol>
        <h3>Handtekeningen</h3>
        <p>
          Het zorgplan kan digitaal ondertekend worden door de client (of
          wettelijk vertegenwoordiger) en de verantwoordelijke zorgverlener. Dit wordt
          opgeslagen als Consent-resource.
        </p>
      </div>
    ),
  },
  {
    id: "berichten",
    title: "Hoe werken berichten",
    content: (
      <div className="prose-section">
        <p>
          Het berichtensysteem is bedoeld voor interne communicatie tussen medewerkers. Denk
          aan overdrachten, vragen over clienten en organisatorische berichten.
        </p>
        <h3>Berichten versturen</h3>
        <ol>
          <li>
            Ga naar <strong>Berichten</strong> in het menu
          </li>
          <li>Klik op &ldquo;Nieuw bericht&rdquo;</li>
          <li>Selecteer de ontvanger(s)</li>
          <li>Vul het onderwerp en bericht in</li>
          <li>Klik op &ldquo;Versturen&rdquo;</li>
        </ol>
        <h3>Overdrachten</h3>
        <p>
          Bij dienstwisseling is het belangrijk om een overdracht te sturen naar de
          opvolgende collega. Vermeld hierin:
        </p>
        <ul>
          <li>Bijzonderheden bij clienten</li>
          <li>Lopende acties die opgepakt moeten worden</li>
          <li>Afspraken met externe partijen (huisarts, apotheek)</li>
        </ul>
        <h3>Tips</h3>
        <ul>
          <li>Gebruik een duidelijk onderwerp zodat berichten snel terug te vinden zijn</li>
          <li>
            Vermeld geen clientgegevens in het onderwerp — gebruik alleen voornaam of
            kamer-/routenummer
          </li>
          <li>Ongelezen berichten worden getoond met een badge in het menu</li>
        </ul>
      </div>
    ),
  },
  {
    id: "planning",
    title: "Hoe werkt de planning",
    content: (
      <div className="prose-section">
        <p>
          De planningsmodule helpt bij het organiseren van zorgmomenten, roosters en
          beschikbaarheid van medewerkers.
        </p>
        <h3>Onderdelen</h3>
        <table>
          <thead>
            <tr>
              <th>Onderdeel</th>
              <th>Omschrijving</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Overzicht</strong></td>
              <td>Weekoverzicht van alle geplande afspraken</td>
            </tr>
            <tr>
              <td><strong>Dagplanning</strong></td>
              <td>Gedetailleerd dagschema per medewerker of per client</td>
            </tr>
            <tr>
              <td><strong>Rooster</strong></td>
              <td>Dienstroosters van medewerkers (ochtend, middag, avond, nacht)</td>
            </tr>
            <tr>
              <td><strong>Herhalingen</strong></td>
              <td>Terugkerende afspraken instellen (bijv. dagelijkse medicatie-uitgifte)</td>
            </tr>
            <tr>
              <td><strong>Wachtlijst</strong></td>
              <td>Clienten die wachten op een zorgplek of intake</td>
            </tr>
          </tbody>
        </table>
        <h3>Een afspraak plannen</h3>
        <ol>
          <li>Ga naar <strong>Planning &rarr; Overzicht</strong></li>
          <li>Klik op het gewenste tijdslot of op &ldquo;Nieuwe afspraak&rdquo;</li>
          <li>Selecteer de client en medewerker</li>
          <li>Kies het type zorgactiviteit</li>
          <li>Sla de afspraak op</li>
        </ol>
        <h3>Beschikbaarheid</h3>
        <p>
          Medewerkers kunnen hun beschikbaarheid opgeven via het rooster. De planner
          ziet automatisch wie beschikbaar is bij het inplannen van afspraken.
        </p>
      </div>
    ),
  },
  {
    id: "rollen",
    title: "Rollen uitleg",
    content: (
      <div className="prose-section">
        <p>
          In OpenZorg heeft elke gebruiker een rol. De rol bepaalt welke onderdelen
          van het systeem je kunt zien en gebruiken.
        </p>
        <h3>Overzicht rollen</h3>
        <table>
          <thead>
            <tr>
              <th>Rol</th>
              <th>Omschrijving</th>
              <th>Belangrijkste rechten</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Beheerder</strong></td>
              <td>Organisatiebeheerder</td>
              <td>
                Volledige toegang: medewerkers beheren, configuratie aanpassen,
                rollen toewijzen, alle modules
              </td>
            </tr>
            <tr>
              <td><strong>Zorgmedewerker</strong></td>
              <td>Verpleegkundige / verzorgende</td>
              <td>
                Clienten inzien en bewerken, zorgplannen, rapportages schrijven,
                medicatie registreren
              </td>
            </tr>
            <tr>
              <td><strong>Teamleider</strong></td>
              <td>Afdelingshoofd / coordinator</td>
              <td>
                Alles van zorgmedewerker, plus medewerkers inzien, MIC-meldingen
                afhandelen, workflows beheren
              </td>
            </tr>
            <tr>
              <td><strong>Planner</strong></td>
              <td>Roostermaker</td>
              <td>
                Planning, roosters, beschikbaarheid, wachtlijst. Beperkte
                toegang tot clientgegevens
              </td>
            </tr>
          </tbody>
        </table>
        <h3>Wat als ik iets niet kan zien?</h3>
        <p>
          Als een menu-item niet zichtbaar is of je krijgt de melding &ldquo;Geen
          toegang&rdquo;, dan heeft jouw rol niet de benodigde rechten. Neem contact
          op met de beheerder van je organisatie om je rol aan te passen.
        </p>
      </div>
    ),
  },
  {
    id: "faq",
    title: "Veelgestelde vragen",
    content: (
      <div className="prose-section">
        <h3>Algemeen</h3>
        <p><strong>Hoe log ik in?</strong></p>
        <p>
          Ga naar de inlogpagina van je organisatie. Vul je e-mailadres en wachtwoord in.
          Bij problemen: neem contact op met je beheerder.
        </p>

        <p><strong>Kan ik mijn wachtwoord wijzigen?</strong></p>
        <p>
          Ja, neem contact op met de beheerder van je organisatie. Zij kunnen je wachtwoord
          resetten.
        </p>

        <p><strong>Werkt het systeem op mijn telefoon?</strong></p>
        <p>
          Ja, OpenZorg is volledig responsive en werkt op telefoons, tablets en computers.
          Er is geen aparte app nodig.
        </p>

        <h3>Clienten</h3>
        <p><strong>Hoe voeg ik een nieuwe client toe?</strong></p>
        <p>
          Ga naar <strong>Clienten</strong> en klik op &ldquo;Nieuwe client&rdquo;.
          Vul de basisgegevens in (naam, geboortedatum, BSN) en sla op.
        </p>

        <p><strong>Waar vind ik het zorgplan?</strong></p>
        <p>
          Open het clientdossier en klik op het tabblad &ldquo;Zorgplan&rdquo;. Hier zie
          je alle doelen, acties en evaluaties.
        </p>

        <h3>Planning</h3>
        <p><strong>Hoe wissel ik een dienst met een collega?</strong></p>
        <p>
          Stuur een bericht naar de planner met het verzoek. De planner kan de
          diensten aanpassen in het rooster.
        </p>

        <p><strong>Waar zie ik mijn rooster?</strong></p>
        <p>
          Ga naar <strong>Planning &rarr; Rooster</strong>. Hier zie je je eigen
          diensten en die van je team.
        </p>

        <h3>Technisch</h3>
        <p><strong>Welke browser wordt ondersteund?</strong></p>
        <p>
          OpenZorg werkt het best in Chrome, Firefox, Safari en Edge. Gebruik altijd
          de laatste versie van je browser.
        </p>

        <p><strong>Worden mijn gegevens veilig opgeslagen?</strong></p>
        <p>
          Ja. Alle data wordt versleuteld opgeslagen en is alleen toegankelijk met de
          juiste inloggegevens. Het systeem voldoet aan NEN 7510 en NEN 7513
          (auditlogging).
        </p>
      </div>
    ),
  },
];

/* ── Wiki page ── */

export default function UserWikiPage() {
  const [activeSection, setActiveSection] = useState("dashboard-config");

  const section = WIKI_SECTIONS.find((s) => s.id === activeSection) ?? WIKI_SECTIONS[0];

  return (
    <AppShell>
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-8">
        <div className="mb-6">
          <h1 className="text-display-md font-display font-bold text-fg">Wiki</h1>
          <p className="text-body-sm text-fg-muted mt-1">
            Handleidingen en veelgestelde vragen
          </p>
        </div>

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
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-raised rounded-2xl border border-default p-8 shadow-soft">
              <h2 className="text-display-md text-fg font-display mb-6">
                {section?.title}
              </h2>
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
    </AppShell>
  );
}
