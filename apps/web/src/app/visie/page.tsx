"use client";

import Link from "next/link";

import { LogoLockup, LogoMark } from "../../components/LogoMark";

export default function VisiePage() {
  return (
    <div className="min-h-screen bg-page text-fg">
      {/* ── Top nav ── */}
      <header className="border-b border-default bg-raised/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="hover:opacity-80">
            <LogoLockup size={34} />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-fg-muted hover:text-fg">Home</Link>
            <Link href="/#backlog" className="text-fg-muted hover:text-fg">Backlog</Link>
            <a href="https://github.com/vierkant14/openzorg" target="_blank" rel="noreferrer" className="text-fg-muted hover:text-fg">GitHub</a>
            <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 btn-press">Inloggen</Link>
          </nav>
        </div>
      </header>

      {/* ── Header ── */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-3">Onze visie</div>
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          De zorg is publiek.<br />
          De software zou dat ook moeten zijn.
        </h1>
        <p className="text-xl text-fg-muted leading-relaxed">
          Waarom we de hele Nederlandse zorg-ICT open source maken — en waarom dat
          nu, na 20 jaar gesloten systemen, eindelijk kan.
        </p>
      </section>

      {/* ── Body ── */}
      <article className="mx-auto max-w-3xl px-6 pb-20 prose-lg">
        <Section title="1 · Het probleem">
          <p>
            Nederland geeft meer dan <strong>€100 miljard per jaar</strong> uit aan
            zorg. Een substantieel deel daarvan stroomt door naar ICT — Elektronische
            Cliëntendossiers (ECD), Elektronische Patiëntendossiers (EPD),
            planningssystemen, declaratiemotoren, administratieve systemen. Die ICT
            draait vrijwel volledig op propriëtaire software van een klein aantal
            commerciële leveranciers.
          </p>
          <Pull>
            In de ziekenhuismarkt heeft één vendor 72% van alle Nederlandse
            ziekenhuizen in handen. Per 2026 blijven er nog 3 EPD-leveranciers over.
          </Pull>
          <Pull>
            In de VVT heeft de marktleider 58% van alle grote ouderzorg-instellingen.
            Diens aandeel groeide in 5 jaar met ruim 20%.
          </Pull>
          <Pull>
            In de gehandicaptenzorg heeft diezelfde marktleider 56% van alle
            grote GHZ-instellingen. De top 3 samen dekt bijna 100%.
          </Pull>
          <p>
            Dit is geen gezonde markt. Dit is oligopolie. En in een oligopolie
            verdwijnen de prikkels die gebruikers beschermen tegen slechte producten,
            stille prijsverhogingen, trage innovatie en data die hun niet meer toebehoort.
          </p>
        </Section>

        <Section title="2 · Waarom dit geen technisch probleem is">
          <p>
            Je zou kunnen denken: <em>"ok, maar die leveranciers bouwen gewoon goed product,
            vandaar die positie."</em> Dat is te makkelijk. De échte reden dat zorginstellingen
            niet wisselen is niet omdat de alternatieven slecht zijn — er zijn nauwelijks
            alternatieven om te beoordelen. De werkelijke barrière is:
          </p>
          <ul>
            <li><strong>Migratiekosten van miljoenen</strong> — jaren data, custom koppelingen, integraties met declaratie-systemen.</li>
            <li><strong>Data-ownership in de praktijk</strong> — cliëntdata is juridisch van de zorginstelling, technisch gegijzeld in een formaat dat alleen de vendor snapt.</li>
            <li><strong>Gebrek aan doorzicht in de kostenstructuur</strong> — "licentie", "hosting", "onderhoud", "implementatie" worden in één offerte samengevoegd waardoor niemand kan uitrekenen wat iets eigenlijk kost.</li>
            <li><strong>Geen publieke kwaliteitsinformatie</strong> — er bestaan geen benchmarks die aantonen welk systeem een verpleegkundige sneller laat werken dan een ander.</li>
          </ul>
          <p>
            <strong>Dit is een markt-falen-probleem, geen technologie-probleem.</strong>
            {" "}En dat maakt dit bij uitstek een terrein waar publieke, transparante
            infrastructuur het verschil kan maken — zoals DigiD, de BRP, MijnOverheid
            en PGO dat hebben laten zien.
          </p>
        </Section>

        <Section title="3 · Wat OpenZorg wil zijn">
          <p>
            OpenZorg is een <strong>volwaardig alternatief</strong>, gebouwd in de
            open lucht, eigendom van een Stichting (non-profit), gelicenceerd onder
            de European Union Public Licence (EUPL 1.2), met de volledige broncode op
            GitHub. Zorginstellingen kunnen kiezen:
          </p>
          <ol>
            <li><strong>Zelf hosten</strong> — pak de Docker-compose van GitHub, draai 'm op je eigen servers, pas aan wat je wilt, betaal niemand.</li>
            <li><strong>Laten hosten door onze B.V.</strong> — voorspelbare maandprijs per tenant, transparant op de site, ondersteuning en upgrades inbegrepen.</li>
            <li><strong>Laten hosten door een derde</strong> — iedere zorg-IT leverancier mag OpenZorg hosten en er bovenop service verkopen. Wij houden de code vrij.</li>
          </ol>
          <Pull>
            Software: gratis. Service: eerlijk geprijsd. Data: van jou.
          </Pull>
          <p>
            Het verschil met het huidige model is simpel: je betaalt voor zichtbare
            diensten, niet voor onzichtbare licenties. En als we het verpesten,
            kun je letterlijk morgen overstappen — de data is FHIR, de broncode is
            van jou, de export-scripts staan in dezelfde repository.
          </p>
        </Section>

        <Section title="4 · Waarom juist nu">
          <p>
            Vijf jaar geleden zou dit project onhaalbaar zijn geweest. Nu wel,
            omdat drie ontwikkelingen samenkomen:
          </p>
          <ul>
            <li><strong>FHIR R4 is mature</strong> — HL7 heeft een standaard die eindelijk in productie wordt gebruikt. Nederlandse Zib-profielen maken het concreet toepasbaar.</li>
            <li><strong>Open-source platformcomponenten bestaan</strong> — Medplum (FHIR server), Flowable (BPMN workflow), PostgreSQL met Row-Level Security. We hoeven het wiel niet opnieuw uit te vinden.</li>
            <li><strong>AI versnelt ontwikkeling met een factor 10</strong> — wat vroeger een team van 20 vereiste, kan nu door een klein kernteam gebouwd worden dat AI inzet voor code, tests en documentatie. Dit maakt het economisch mogelijk om een gratis alternatief te bouwen.</li>
          </ul>
          <p>
            Ook de politieke context is gunstig: het ministerie van VWS publiceert
            open-standaardenbeleid, het Informatieberaad Zorg stuurt op interoperabiliteit,
            en zorginstellingen eisen steeds explicieter dat hun data verplaatsbaar is.
          </p>
        </Section>

        <Section title="5 · Hoe we dit betalen">
          <p>
            Stichting OpenZorg is non-profit en houdt de broncode onder EUPL 1.2. Er
            zijn drie geldstromen:
          </p>
          <ul>
            <li><strong>Fondsen en subsidies</strong> — van VWS, EU Digital Health programma's, zorgverzekeraars die interoperabiliteit willen afdwingen, en filantropische fondsen die de zorg willen verbeteren.</li>
            <li><strong>Hosting B.V.</strong> — onze eigen commerciële B.V. biedt managed hosting tegen een transparante prijs. Winst gaat (na belastingen en salarissen) terug naar de Stichting.</li>
            <li><strong>Consulting en implementatie</strong> — voor zorginstellingen die hulp willen bij migratie of maatwerk.</li>
          </ul>
          <p>
            De kern-filosofie: de <strong>software</strong> is gratis, de
            <strong> service</strong> is eerlijk geprijsd, en de
            <strong> governance</strong> is transparant. Alle jaarrekeningen van de
            Stichting worden publiek gemaakt.
          </p>
        </Section>

        <Section title="6 · Het plan voor de komende 24 maanden">
          <p>
            We starten bij VVT omdat daar de urgentie het hoogst is en de
            complexiteit werkbaar. De architectuur is vanaf dag één generiek:
            FHIR-native, multi-tenant, modulair. Daardoor kunnen we sector na
            sector toevoegen zonder het platform opnieuw te bouwen.
          </p>
          <ul>
            <li><strong>Q2 2026</strong> — Eerste pilots in VVT. Cliëntdossier, medicatie, zorgplan, planning, facturatie, workflow-engine. Compliance met Wlz en NEN 7513.</li>
            <li><strong>Q3 2026</strong> — CIZ-indicatie koppeling, Vecozo declaratie-export, drag-and-drop rooster, SMART-doel validatie, evaluatie-scheduler.</li>
            <li><strong>Q4 2026</strong> — LSP-koppeling via Nictiz, eOverdracht, mobile companion app.</li>
            <li><strong>2027</strong> — Uitrol naar GHZ en GGZ. Eerste gesprekken met ziekenhuizen over een open-source EPD-tier. Jeugdzorg-module.</li>
          </ul>
          <p>
            Na 2027: schaalvergroting, internationale Nederlandse-taalgebieden
            (België, Suriname, Curaçao), en waar mogelijk vertaling naar andere
            Europese zorgstelsels via de EUPL-licentie.
          </p>
        </Section>

        <Section title="7 · Wat we van jou vragen">
          <p>
            Dit is geen project dat door één persoon of één team gebouwd wordt. We
            hebben zorgverleners nodig die feedback geven op de functionaliteit,
            instellingen die willen piloten, ontwikkelaars die willen bijdragen, en
            fondsen die de visie willen ondersteunen.
          </p>
          <p>
            Concreet kan je <strong>nu</strong> al:
          </p>
          <ul>
            <li><Link href="/login" className="text-brand-600 hover:underline">De demo proberen</Link> — log in en klik rond, stuur feedback.</li>
            <li><a href="https://github.com/vierkant14/openzorg" className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">Broncode bekijken op GitHub</a> — issues openen, PR's indienen, forken.</li>
            <li><a href="https://www.notion.so/e9f47053acdf445487daece2e8c6ace0" className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">Backlog volgen op Notion</a> — zie wat er gebeurt en stem mee over prioriteit.</li>
            <li>Contact opnemen voor een pilot — mail ons via het GitHub-profiel.</li>
          </ul>
        </Section>

        <div className="mt-16 p-8 rounded-2xl border-2 border-brand-400 bg-brand-50/50 dark:bg-brand-950/20 text-center">
          <LogoMark size={56} className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">De zorg verdient beter dan vendor lock-in.</h2>
          <p className="text-fg-muted mb-6 max-w-xl mx-auto">
            Wij bouwen het alternatief. Als je mee wil doen — als gebruiker,
            ontwikkelaar, instelling of financier — we zijn online.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/login" className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 btn-press">
              Start met de demo →
            </Link>
            <a href="https://github.com/vierkant14/openzorg" target="_blank" rel="noreferrer" className="rounded-xl border border-default bg-page px-6 py-3 text-sm font-semibold text-fg hover:bg-sunken btn-press">
              Bekijk GitHub
            </a>
          </div>
        </div>
      </article>

      {/* ── Footer ── */}
      <footer className="border-t border-default bg-raised py-10">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-fg-muted">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div>
              <div className="font-semibold text-fg">Stichting OpenZorg</div>
              <div>Non-profit · EUPL 1.2 · Nederland</div>
            </div>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-fg">Home</Link>
            <a href="https://github.com/vierkant14/openzorg" target="_blank" rel="noreferrer" className="hover:text-fg">GitHub</a>
            <Link href="/login" className="hover:text-fg">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-fg mb-4 border-b border-default pb-2">{title}</h2>
      <div className="space-y-4 text-fg-muted leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-2 [&_strong]:text-fg">
        {children}
      </div>
    </section>
  );
}

function Pull({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-4 border-brand-500 bg-brand-50/40 dark:bg-brand-950/10 pl-5 py-3 my-5 text-lg italic text-fg">
      {children}
    </blockquote>
  );
}
