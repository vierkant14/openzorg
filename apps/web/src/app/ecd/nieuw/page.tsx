"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

const MARITAL_STATUSES = [
  { code: "UNK", display: "Onbekend" },
  { code: "U", display: "Ongehuwd" },
  { code: "M", display: "Gehuwd" },
  { code: "D", display: "Gescheiden" },
  { code: "W", display: "Weduwe/weduwnaar" },
  { code: "T", display: "Geregistreerd partnerschap" },
  { code: "L", display: "Samenwonend" },
];

const INDICATIE_TYPES = [
  { code: "wlz", display: "Wet langdurige zorg (Wlz)" },
  { code: "wmo", display: "Wet maatschappelijke ondersteuning (Wmo)" },
  { code: "zvw", display: "Zorgverzekeringswet (Zvw)" },
  { code: "jeugdwet", display: "Jeugdwet" },
];

const inputClass =
  "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
const selectClass = inputClass;

export default function NieuweClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persoonsgegevens
  const [voornaam, setVoornaam] = useState("");
  const [tussenvoegsel, setTussenvoegsel] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [geboortedatum, setGeboortedatum] = useState("");
  const [geslacht, setGeslacht] = useState("unknown");
  const [bsn, setBsn] = useState("");
  const [burgerlijkeStaat, setBurgerlijkeStaat] = useState("UNK");

  // Contactgegevens
  const [telefoon, setTelefoon] = useState("");
  const [telefoonMobiel, setTelefoonMobiel] = useState("");
  const [email, setEmail] = useState("");

  // Adres
  const [straat, setStraat] = useState("");
  const [huisnummer, setHuisnummer] = useState("");
  const [huisnummerToevoeging, setHuisnummerToevoeging] = useState("");
  const [postcode, setPostcode] = useState("");
  const [woonplaats, setWoonplaats] = useState("");

  // Medewerkers lookup
  const [medewerkers, setMedewerkers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/medewerkers")
      .then(({ data }) => {
        const list = data?.entry?.map((e) => ({
          id: e.resource.id,
          name: [
            ...(e.resource.name?.[0]?.given ?? []),
            e.resource.name?.[0]?.family ?? "",
          ].filter(Boolean).join(" ") || e.resource.id,
        })) ?? [];
        setMedewerkers(list);
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Organisatie locaties lookup
  const [locaties, setLocaties] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: string } }> }>("/api/organisatie")
      .then(({ data }) => {
        const list = data?.entry?.map((e) => ({
          id: e.resource.id,
          name: e.resource.name ?? e.resource.id,
        })) ?? [];
        setLocaties(list);
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Zorgcontext
  const [huisarts, setHuisarts] = useState("");
  const [locatieId, setLocatieId] = useState("");
  const [_apotheek, _setApotheek] = useState("");
  const [verzekeraar, setVerzekeraar] = useState("");
  const [polisnummer, setPolisnummer] = useState("");

  // Indicatie
  const [indicatieType, setIndicatieType] = useState("");
  const [indicatieBesluitnummer, setIndicatieBesluitnummer] = useState("");
  const [indicatieStartdatum, setIndicatieStartdatum] = useState("");
  const [indicatieEinddatum, setIndicatieEinddatum] = useState("");
  const [zorgprofiel, setZorgprofiel] = useState("");

  const [bsnError, setBsnError] = useState<string | null>(null);

  // Fetch tenant settings to determine if BSN is required
  const [bsnRequired, setBsnRequired] = useState(false);
  useEffect(() => {
    ecdFetch<{ bsnRequired?: boolean }>("/api/tenant-settings")
      .then(({ data }) => {
        if (data?.bsnRequired) setBsnRequired(true);
      })
      .catch(() => { /* use default */ });
  }, []);

  function validateBsn(value: string): boolean {
    if (!value && bsnRequired) {
      setBsnError("BSN is verplicht voor deze organisatie");
      return false;
    }
    if (!value) return true; // BSN is optional
    if (!/^\d{9}$/.test(value)) {
      setBsnError("BSN moet exact 9 cijfers bevatten");
      return false;
    }
    setBsnError(null);
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateBsn(bsn)) return;

    const familyName = tussenvoegsel
      ? `${tussenvoegsel} ${achternaam}`
      : achternaam;

    const telecom = [
      ...(telefoon ? [{ system: "phone" as const, value: telefoon, use: "home" as const }] : []),
      ...(telefoonMobiel ? [{ system: "phone" as const, value: telefoonMobiel, use: "mobile" as const }] : []),
      ...(email ? [{ system: "email" as const, value: email }] : []),
    ];

    const address = straat || postcode || woonplaats
      ? [{
          line: [
            [straat, huisnummer, huisnummerToevoeging]
              .filter(Boolean)
              .join(" "),
          ].filter(Boolean),
          postalCode: postcode || undefined,
          city: woonplaats || undefined,
          country: "NL",
        }]
      : [];

    const extensions: Array<{ url: string; valueString?: string; extension?: Array<{ url: string; valueString?: string }> }> = [];

    if (verzekeraar || polisnummer) {
      extensions.push({
        url: "https://openzorg.nl/extensions/verzekering",
        extension: [
          ...(verzekeraar ? [{ url: "verzekeraar", valueString: verzekeraar }] : []),
          ...(polisnummer ? [{ url: "polisnummer", valueString: polisnummer }] : []),
        ],
      });
    }

    if (indicatieType) {
      extensions.push({
        url: "https://openzorg.nl/extensions/indicatie",
        extension: [
          { url: "type", valueString: indicatieType },
          ...(indicatieBesluitnummer ? [{ url: "besluitnummer", valueString: indicatieBesluitnummer }] : []),
          ...(indicatieStartdatum ? [{ url: "startdatum", valueString: indicatieStartdatum }] : []),
          ...(indicatieEinddatum ? [{ url: "einddatum", valueString: indicatieEinddatum }] : []),
          ...(zorgprofiel ? [{ url: "zorgprofiel", valueString: zorgprofiel }] : []),
        ],
      });
    }

    const maritalCode = burgerlijkeStaat !== "UNK" ? burgerlijkeStaat : undefined;

    const body = {
      resourceType: "Patient",
      name: [{ family: familyName, given: [voornaam] }],
      birthDate: geboortedatum,
      gender: geslacht,
      identifier: bsn
        ? [{ system: "http://fhir.nl/fhir/NamingSystem/bsn", value: bsn }]
        : [],
      telecom,
      ...(address.length > 0 ? { address } : {}),
      ...(maritalCode
        ? {
            maritalStatus: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
                  code: maritalCode,
                },
              ],
            },
          }
        : {}),
      ...(huisarts
        ? {
            generalPractitioner: [{
              reference: huisarts.startsWith("Practitioner/") ? huisarts : undefined,
              display: medewerkers.find((m) => `Practitioner/${m.id}` === huisarts)?.name ?? huisarts,
            }],
          }
        : {}),
      ...(locatieId
        ? {
            managingOrganization: {
              reference: `Organization/${locatieId}`,
              display: locaties.find((l) => l.id === locatieId)?.name ?? locatieId,
            },
          }
        : {}),
      ...(extensions.length > 0 ? { extension: extensions } : {}),
    };

    setLoading(true);
    const { data, error: apiError } = await ecdFetch<{ id?: string }>(
      "/api/clients",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    if (data?.id) {
      // Create Coverage resource if verzekeraar or polisnummer provided
      if (verzekeraar || polisnummer) {
        await ecdFetch(`/api/clients/${data.id}/verzekering`, {
          method: "POST",
          body: JSON.stringify({
            verzekeraar: verzekeraar || undefined,
            polisnummer: polisnummer || undefined,
            financieringstype: indicatieType || undefined,
            ingangsdatum: indicatieStartdatum || undefined,
            einddatum: indicatieEinddatum || undefined,
            zzpKlasse: zorgprofiel || undefined,
          }),
        });
      }
      router.push(`/ecd/${data.id}`);
    }
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <a
          href="/ecd"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900 mb-4"
        >
          &larr; Terug
        </a>

        <h2 className="text-2xl font-bold text-fg mb-6">
          Nieuwe client aanmaken
        </h2>

        {error && (
          <div className="mb-6 p-4 bg-coral-50 border border-coral-200 rounded-lg text-coral-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Persoonsgegevens ── */}
          <FormSection title="Persoonsgegevens">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel required>Voornaam</FormLabel>
                <input type="text" required value={voornaam} onChange={(e) => setVoornaam(e.target.value)} className={inputClass} />
              </div>
              <div>
                <FormLabel>Tussenvoegsel</FormLabel>
                <input type="text" value={tussenvoegsel} onChange={(e) => setTussenvoegsel(e.target.value)} placeholder="van, de, van der" className={inputClass} />
              </div>
              <div>
                <FormLabel required>Achternaam</FormLabel>
                <input type="text" required value={achternaam} onChange={(e) => setAchternaam(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel required>Geboortedatum</FormLabel>
                <input type="date" required value={geboortedatum} onChange={(e) => setGeboortedatum(e.target.value)} className={inputClass} />
              </div>
              <div>
                <FormLabel required>Geslacht</FormLabel>
                <select required value={geslacht} onChange={(e) => setGeslacht(e.target.value)} className={selectClass}>
                  <option value="unknown">Onbekend</option>
                  <option value="male">Man</option>
                  <option value="female">Vrouw</option>
                  <option value="other">Anders</option>
                </select>
              </div>
              <div>
                <FormLabel>Burgerlijke staat</FormLabel>
                <select value={burgerlijkeStaat} onChange={(e) => setBurgerlijkeStaat(e.target.value)} className={selectClass}>
                  {MARITAL_STATUSES.map((ms) => (
                    <option key={ms.code} value={ms.code}>{ms.display}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <FormLabel required={bsnRequired}>BSN (Burgerservicenummer)</FormLabel>
              <input
                type="text"
                maxLength={9}
                inputMode="numeric"
                value={bsn}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setBsn(v);
                  if (bsnError) validateBsn(v);
                }}
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
                  bsnError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                    : "border-default focus:border-brand-500 focus:ring-brand-500"
                }`}
              />
              {bsnError && <p className="mt-1 text-xs text-coral-600">{bsnError}</p>}
              <p className="mt-1 text-xs text-fg-subtle">
                {bsnRequired ? "Verplicht voor deze organisatie — " : "Optioneel — "}
                9 cijfers, elfproef wordt door de server gecontroleerd. Clientnummer wordt automatisch gegenereerd.
              </p>
            </div>
          </FormSection>

          {/* ── Contactgegevens ── */}
          <FormSection title="Contactgegevens">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel>Telefoon (vast)</FormLabel>
                <input type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="0201234567" className={inputClass} />
              </div>
              <div>
                <FormLabel>Telefoon (mobiel)</FormLabel>
                <input type="tel" value={telefoonMobiel} onChange={(e) => setTelefoonMobiel(e.target.value)} placeholder="0612345678" className={inputClass} />
              </div>
              <div>
                <FormLabel>E-mailadres</FormLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@voorbeeld.nl" className={inputClass} />
              </div>
            </div>
          </FormSection>

          {/* ── Adres ── */}
          <FormSection title="Adres">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <FormLabel>Straatnaam</FormLabel>
                <input type="text" value={straat} onChange={(e) => setStraat(e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FormLabel>Huisnr.</FormLabel>
                  <input type="text" value={huisnummer} onChange={(e) => setHuisnummer(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FormLabel>Toev.</FormLabel>
                  <input type="text" value={huisnummerToevoeging} onChange={(e) => setHuisnummerToevoeging(e.target.value)} placeholder="A, bis" className={inputClass} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel>Postcode</FormLabel>
                <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="1234 AB" maxLength={7} className={inputClass} />
              </div>
              <div>
                <FormLabel>Woonplaats</FormLabel>
                <input type="text" value={woonplaats} onChange={(e) => setWoonplaats(e.target.value)} className={inputClass} />
              </div>
            </div>
          </FormSection>

          {/* ── Zorgcontext ── */}
          <FormSection title="Zorgcontext">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel>Behandelaar / Huisarts</FormLabel>
                <select value={huisarts} onChange={(e) => setHuisarts(e.target.value)} className={selectClass}>
                  <option value="">Selecteer een behandelaar</option>
                  {medewerkers.map((m) => (
                    <option key={m.id} value={`Practitioner/${m.id}`}>{m.name}</option>
                  ))}
                </select>
                {medewerkers.length === 0 && (
                  <p className="mt-1 text-xs text-fg-subtle">Geen medewerkers gevonden. Voeg eerst medewerkers toe via Beheer → Medewerkers.</p>
                )}
              </div>
              <div>
                <FormLabel>Locatie / Cluster</FormLabel>
                <select value={locatieId} onChange={(e) => setLocatieId(e.target.value)} className={selectClass}>
                  <option value="">Geen locatie</option>
                  {locaties.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel>Verzekeraar</FormLabel>
                <select value={verzekeraar} onChange={(e) => setVerzekeraar(e.target.value)} className={selectClass}>
                  <option value="">Selecteer verzekeraar</option>
                  <option value="Zilveren Kruis">Zilveren Kruis</option>
                  <option value="VGZ">VGZ</option>
                  <option value="CZ">CZ</option>
                  <option value="Menzis">Menzis</option>
                  <option value="ONVZ">ONVZ</option>
                  <option value="DSW">DSW</option>
                  <option value="Zorg en Zekerheid">Zorg en Zekerheid</option>
                  <option value="a.s.r.">a.s.r.</option>
                  <option value="EUCARE">EUCARE</option>
                  <option value="Caresq">Caresq</option>
                  <option value="iptiQ">iptiQ</option>
                  <option value="Eno">Eno</option>
                  <option value="Salland">Salland</option>
                </select>
              </div>
              <div>
                <FormLabel>Polisnummer</FormLabel>
                <input type="text" value={polisnummer} onChange={(e) => setPolisnummer(e.target.value)} className={inputClass} />
              </div>
            </div>
          </FormSection>

          {/* ── Indicatie ── */}
          <FormSection title="Indicatie">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel>Indicatietype</FormLabel>
                <select value={indicatieType} onChange={(e) => setIndicatieType(e.target.value)} className={selectClass}>
                  <option value="">Geen indicatie</option>
                  {INDICATIE_TYPES.map((it) => (
                    <option key={it.code} value={it.code}>{it.display}</option>
                  ))}
                </select>
              </div>
              <div>
                <FormLabel>CIZ Besluitnummer</FormLabel>
                <input type="text" value={indicatieBesluitnummer} onChange={(e) => setIndicatieBesluitnummer(e.target.value)} className={inputClass} />
              </div>
            </div>
            {indicatieType && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <FormLabel>Startdatum indicatie</FormLabel>
                  <input type="date" value={indicatieStartdatum} onChange={(e) => setIndicatieStartdatum(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FormLabel>Einddatum indicatie</FormLabel>
                  <input type="date" value={indicatieEinddatum} onChange={(e) => setIndicatieEinddatum(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <FormLabel>Zorgprofiel (ZZP/VPT)</FormLabel>
                  <select value={zorgprofiel} onChange={(e) => setZorgprofiel(e.target.value)} className={selectClass}>
                    <option value="">Selecteer zorgprofiel</option>
                    <optgroup label="Verpleging & Verzorging">
                      <option value="VV-01">VV-01 — Beschut wonen met begeleiding</option>
                      <option value="VV-02">VV-02 — Beschut wonen met begeleiding en verzorging</option>
                      <option value="VV-03">VV-03 — Beschut wonen met begeleiding en intensieve verzorging</option>
                      <option value="VV-04">VV-04 — Beschut wonen met intensieve begeleiding en uitgebreide verzorging</option>
                      <option value="VV-05">VV-05 — Beschermd wonen met intensieve dementiezorg</option>
                      <option value="VV-06">VV-06 — Beschermd wonen met intensieve verzorging en verpleging</option>
                      <option value="VV-07">VV-07 — Beschermd wonen met zeer intensieve zorg</option>
                      <option value="VV-08">VV-08 — Beschermd wonen met zeer intensieve zorg vanwege specifieke aandoeningen</option>
                      <option value="VV-09">VV-09 — Herstelgerichte behandeling met verpleging en verzorging</option>
                      <option value="VV-10">VV-10 — Beschermd verblijf met intensieve palliatief-terminale zorg</option>
                    </optgroup>
                    <optgroup label="VPT / MPT">
                      <option value="VPT">VPT — Volledig Pakket Thuis</option>
                      <option value="MPT">MPT — Modulair Pakket Thuis</option>
                      <option value="PGB">PGB — Persoonsgebonden Budget</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            )}
          </FormSection>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <a
              href="/ecd"
              className="px-4 py-2 text-sm font-medium text-fg-muted bg-raised border border-default rounded-md hover:bg-sunken"
            >
              Annuleren
            </a>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50"
            >
              {loading ? "Opslaan..." : "Client aanmaken"}
            </button>
          </div>
        </form>
      </main>
    </AppShell>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-raised rounded-lg border p-6 space-y-4">
      <legend className="text-sm font-semibold text-fg bg-raised px-2 -ml-1">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-fg-muted mb-1">
      {children}
      {required && <span className="text-coral-500 ml-0.5">*</span>}
    </label>
  );
}
