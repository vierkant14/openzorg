"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface Questionnaire {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  item?: Array<{ linkId?: string; text?: string; type?: string }>;
}

interface QBundle {
  entry?: Array<{ resource: Questionnaire }>;
}

/**
 * Voorbeeld-vragenlijsten die we seeden als de tenant er nog geen heeft.
 * Bewust kort en uitgebreidbaar. Gebaseerd op veelgebruikte VVT-schalen:
 * - Valrisico (FES-I light)
 * - Pijnregistratie NRS
 * - Ondervoeding (SNAQ light)
 * - Intake-anamnese kort
 */
const VOORBEELDEN = [
  {
    title: "Valrisico screening",
    description: "Korte screening op valrisico (FES-I licht). Invullen bij intake en halfjaarlijks.",
    categorie: "screening",
    items: [
      { linkId: "val-1", text: "Bent u in de afgelopen 12 maanden gevallen?", type: "boolean", required: true },
      { linkId: "val-2", text: "Hoe vaak bent u gevallen?", type: "integer", required: false },
      { linkId: "val-3", text: "Gebruikt u een loophulpmiddel?", type: "choice", required: true, options: [
        { value: "geen", display: "Geen" },
        { value: "stok", display: "Stok" },
        { value: "rollator", display: "Rollator" },
        { value: "rolstoel", display: "Rolstoel" },
      ] },
      { linkId: "val-4", text: "Bent u bang om te vallen?", type: "choice", required: true, options: [
        { value: "niet", display: "Helemaal niet" },
        { value: "beetje", display: "Een beetje" },
        { value: "nogal", display: "Nogal" },
        { value: "heel", display: "Heel erg" },
      ] },
      { linkId: "val-5", text: "Toelichting", type: "text", required: false },
    ],
  },
  {
    title: "Pijnregistratie (NRS)",
    description: "Numeric Rating Scale 0-10. Invullen bij pijnklachten en na pijnstillende interventies.",
    categorie: "monitoring",
    items: [
      { linkId: "pijn-1", text: "Pijnscore nu (0 = geen pijn, 10 = ergste pijn)", type: "integer", required: true },
      { linkId: "pijn-2", text: "Pijnscore afgelopen 24 uur gemiddeld", type: "integer", required: false },
      { linkId: "pijn-3", text: "Locatie van de pijn", type: "string", required: false },
      { linkId: "pijn-4", text: "Pijnstilling ingezet?", type: "boolean", required: true },
      { linkId: "pijn-5", text: "Toelichting / karakter van de pijn", type: "text", required: false },
    ],
  },
  {
    title: "SNAQ ondervoeding screening",
    description: "Short Nutritional Assessment Questionnaire. Invullen bij intake en maandelijks.",
    categorie: "screening",
    items: [
      { linkId: "snaq-1", text: "Bent u ongewenst afgevallen (>6 kg in 6 mnd of >3 kg in 1 mnd)?", type: "boolean", required: true },
      { linkId: "snaq-2", text: "Had u de afgelopen maand verminderde eetlust?", type: "boolean", required: true },
      { linkId: "snaq-3", text: "Gebruikte u de afgelopen maand drinkvoeding of sondevoeding?", type: "boolean", required: true },
      { linkId: "snaq-4", text: "Huidig gewicht (kg)", type: "decimal", required: false },
      { linkId: "snaq-5", text: "Lengte (cm)", type: "decimal", required: false },
    ],
  },
  {
    title: "Intake anamnese (kort)",
    description: "Basis anamnese bij aanmelding. Invullen door intake-medewerker.",
    categorie: "intake",
    items: [
      { linkId: "int-1", text: "Reden van aanmelding", type: "text", required: true },
      { linkId: "int-2", text: "Huidige zorgvraag (kort)", type: "text", required: true },
      { linkId: "int-3", text: "Woont thuis?", type: "boolean", required: true },
      { linkId: "int-4", text: "Mantelzorger aanwezig?", type: "boolean", required: true },
      { linkId: "int-5", text: "Naam + telefoon mantelzorger", type: "string", required: false },
      { linkId: "int-6", text: "Huidige medicatie (korte beschrijving)", type: "text", required: false },
      { linkId: "int-7", text: "Allergieën / intoleranties", type: "string", required: false },
      { linkId: "int-8", text: "Urgentie", type: "choice", required: true, options: [
        { value: "laag", display: "Laag - binnen 4 weken" },
        { value: "midden", display: "Midden - binnen 1 week" },
        { value: "hoog", display: "Hoog - binnen 48 uur" },
        { value: "acuut", display: "Acuut - vandaag" },
      ] },
    ],
  },
];

export default function VragenlijstenAdminPage() {
  const [templates, setTemplates] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await ecdFetch<QBundle>("/api/vragenlijsten");
    setTemplates(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function seedVoorbeelden() {
    setSeeding(true);
    setStatus(null);
    let success = 0;
    let failed = 0;
    for (const voorbeeld of VOORBEELDEN) {
      const { error } = await ecdFetch("/api/vragenlijsten", {
        method: "POST",
        body: JSON.stringify(voorbeeld),
      });
      if (error) failed++;
      else success++;
    }
    setSeeding(false);
    setStatus({
      ok: failed === 0,
      text: `${success} voorbeelden toegevoegd${failed > 0 ? `, ${failed} mislukt` : ""}`,
    });
    await load();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-fg">Vragenlijsten beheer</h1>
            <p className="mt-1 text-sm text-fg-muted">
              FHIR Questionnaire templates die zorgmedewerkers kunnen invullen per cliënt.
              Gebruikt voor screenings, monitoring en intake.
            </p>
          </div>
          {templates.length === 0 && !loading && (
            <button
              onClick={seedVoorbeelden}
              disabled={seeding}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 btn-press"
            >
              {seeding ? "Laden…" : "✨ Laad 4 voorbeelden"}
            </button>
          )}
        </div>

        {status && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              status.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-coral-200 bg-coral-50 text-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {status.text}
          </div>
        )}

        {loading && <p className="text-fg-muted">Laden…</p>}

        {!loading && templates.length === 0 && !seeding && (
          <div className="rounded-xl border border-default bg-raised p-8 text-center">
            <p className="text-fg-muted mb-2">Nog geen vragenlijsten in jouw tenant.</p>
            <p className="text-xs text-fg-subtle mb-4">
              Klik op <strong>Laad 4 voorbeelden</strong> rechtsboven om te starten met Valrisico, Pijnregistratie, SNAQ en Intake.
            </p>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-default bg-raised p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-fg">{t.title ?? "Naamloos"}</h2>
                    {t.description && (
                      <p className="mt-1 text-sm text-fg-muted">{t.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-fg-subtle">
                      <span className="rounded bg-sunken px-2 py-0.5">{t.status ?? "unknown"}</span>
                      <span>{t.item?.length ?? 0} vragen</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-fg-subtle">
          💡 Tip: je kunt voorbeelden aanpassen of nieuwe maken. Zorgmedewerkers zien deze
          templates in het cliëntdossier onder de <strong>Vragenlijsten</strong> tab.
        </p>
      </div>
    </AppShell>
  );
}
