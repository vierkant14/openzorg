# Nachtsessie 2026-04-14 → 2026-04-15 — Samenvatting

Goedemorgen. Hieronder een lijst van alles wat ik vannacht heb gedaan terwijl je sliep, met URL's en testpaden zodat je direct kunt verifiëren.

## 🎯 Kernpunten om te testen

1. **Canvas-properties voor alle BPMN element-types** — klik "Goedgekeurd?" gateway aan en zie de paden + condities
2. **"Test dit proces"-knop** werkt end-to-end (deploy + start + werkbak)
3. **Master-admin Platform Settings** — `/master-admin/tenants/[id]/settings` met feature-flags, sessie, branding
4. **Feature-flags live van toepassing** — toggel een feature uit → module verdwijnt uit nav én een directe URL naar die pagina redirect naar `/geen-toegang`
5. **Werkbak filters** — zoek/proces/status
6. **Werkbak toont dueDate** als een taak een SLA heeft
7. **Dashboard persoonlijke begroeting + "Mijn taken" preview**
8. **BPMN import knop** — plak XML, zie diagram
9. **Nieuw (leeg)-knop** — begin vanaf nul

## 📦 Commits vannacht (in volgorde)

```
f2dbb74  canvas: properties-panel voor alle BPMN element-types
f5726cf  plan-2c: platform-settings datamodel + master UI
276edc6  fix(ecd): /api/tenant-features publiek mount
5bdf23c  plan-2c: feature-flags hook + AppShell nav filter
ac26012  dashboard+werkbak: dueDate badges + mijn-taken preview
240e081  plan-2c: FeatureGate op canvas/werkbak/facturatie
c876862  plan-2f-prework: tenant-configureerbare form-opties
```

## 🧪 Testpad — Killer Demo reproduceren

Per hoofdstuk 8.6 van het requirements-document:

1. Log in als `admin@openzorg.nl` (nog altijd `Oz!Adm1n#2026mXq7` — re-seed voor simpel wachtwoord staat in backlog)
2. Ga naar **http://192.168.1.10:13000/admin/workflows/canvas**
3. Klik **"+ Nieuw (leeg)"** om met een schone lei te beginnen
4. Klik **"Template laden" → Intake Proces** — je zou nu een volledig diagram moeten zien met lijnen tussen de elementen (auto-layout + ensureFlowRefs fix)
5. Klik de gateway **"Goedgekeurd?"** aan — het rechterpaneel toont nu de uitgaande paden met hun condities (`${goedgekeurd == true}` etc.) en je kunt ze aanpassen
6. Klik een taak aan, verander de **rol** of vul een **specifieke persoon** in
7. Klik **"▶ Test dit proces"** — systeem deployt + start een instance + springt naar `/werkbak`
8. In de werkbak zie je de eerste taak klaar voor `planner`

## 🧪 Testpad — Platform Admin (Plan 2C)

1. Log in als master admin
2. Ga naar **/master-admin** → kies een tenant
3. Klik rechtsboven op **⚙ Instellingen** (nieuw icoontje)
4. Op de settings-pagina zijn drie tabs: **Features**, **Sessie**, **Branding**
5. Toggel bij Features bv. `facturatie-module` uit, klik **"Features opslaan"**
6. Open een nieuw tabblad, log in als deze tenant-admin, ga naar `/admin/facturatie` — je wordt omgeleid naar `/geen-toegang`
7. Zet de flag weer aan, refresh, en hij is weer beschikbaar

## 🧪 Testpad — Werkbak verbeteringen

1. Ga naar **/werkbak**
2. Drie filters bovenin: **zoek**, **proces-type**, **status**
3. Typen in zoek → taken-lijst filtert live
4. Status "Niet geclaimd" → alleen ongeclaimde taken
5. Teller toont "X van Y taken zichtbaar" met "filters wissen"
6. Als een taak een `dueDate` heeft (via canvas ingesteld), zie je een kleurgecodeerd ⏰ badge (groen > 3d, amber < 3d, koraal verlopen)

## 🐛 Bekende punten (komen niet zomaar weg)

- **BPMN-templates hebben nog incomplete DI** — auto-layout vult het aan maar het blijft ongemakkelijk. Op backlog als "BPMN-templates: volledige BPMN-DI toevoegen".
- **Medplum accessTokenLifetime is nog handmatig** op 1d gezet via directe SQL-update. Dynamische per-tenant lifetime (op basis van platform_settings.session.accessTokenLifetime) staat op Plan 2C fase 5 (nog niet gedaan).
- **Plan 2B workflow afronding** — DMN-editor, form-keys met JSONForms, trigger-type UI voor StartEvent, gateway-condities bewerken UI (al gedeeltelijk werkend via text-input) — staan allemaal als backlog-items.
- **Werkbak rol-als-userId** — nog steeds de hack waar we userId als candidateGroup gebruiken. Backlog.

## 🌓 Wat ik NIET heb gedaan

- **Nieuwe tenant-admin UI voor task-form-options** — het backend-endpoint `/api/task-form-options` bestaat, werkbak merged laag 1+2, maar er is nog geen UI om een functioneel beheerder de opties te laten bewerken. Dit moet in Plan 2F of een aparte kleine plan 2G.
- **Dynamische Medplum token-lifetime** — Plan 2C fase 5 niet afgemaakt. Handmatige SQL update is wel gedaan.
- **BPMN template DI-cleanup** — de handgeschreven templates herschrijven met correcte BPMNEdge/BPMNShape bounds. Auto-layout vult dit nu aan maar imperfect.
- **DMN editor** — grote feature, Plan 2E.
- **Form-keys per userTask** — het property veld is toegevoegd aan het canvas, maar er is geen renderer in de werkbak die dit nog gebruikt.

## ⏰ Ochtendtest checklist

- [ ] Hard refresh http://192.168.1.10:13000 
- [ ] Dashboard toont mijn naam in de begroeting
- [ ] Werkbak toont filter-bar + optioneel dueDate badges
- [ ] Canvas: intake-template heeft lijnen en ik kan gateway-paden bewerken
- [ ] Canvas: "▶ Test dit proces"-knop werkt
- [ ] `/master-admin/tenants/<id>/settings` bestaat en toont de drie tabs
- [ ] Feature-flag uit → directe URL redirect naar /geen-toegang

## 📊 Audit-log query voor BI

Check of je taak-transities correct worden gelogd:

```sql
SELECT
  action,
  details->>'taskName' AS task,
  details->>'processKey' AS process,
  user_id,
  timestamp
FROM openzorg.audit_log
WHERE action LIKE 'workflow.task.%'
ORDER BY timestamp DESC
LIMIT 20;
```

Dit moet rijen opleveren voor elke claim + complete die je via de werkbak hebt gedaan sinds `2a800f2` live is.

---

Fijne ochtend. Test rustig en laat me weten wat stuk is of niet zoals bedoeld.
