# Q2-Plan 2B: Werkbak + Workflow Audit & Herstel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De in bug-bash ronde 1 gevonden P0 ("de werkbak lijkt niet te werken en de workflow is ook niet sterk genoeg") onderzoeken, precies diagnosticeren wat er kapot is, en systematisch herstellen. Dit is een **discovery-first** plan: de fix-fases worden pas concreet gemaakt nadat de audit heeft opgeleverd *wat* er werkelijk mis is.

**Architecture:** OpenZorg gebruikt Flowable Community (BPMN 2.0) als workflow-engine. De chain is: **frontend werkbak-UI** → `/api/workflow/*` proxy → **workflow-bridge service** (Hono, port 4003) → **Flowable REST API**. Taken worden gepersisteerd als Flowable tasks + mogelijk als FHIR Tasks via Medplum. De audit moet vaststellen waar in deze chain het breekt.

**Tech Stack:** Flowable Community, Hono (workflow-bridge), Next.js werkbak-UI, FHIR Task resource, `/api/taken` endpoint.

**Spec referenties:**
- `docs/superpowers/specs/2026-04-13-fundering-eerst-design.md` — Q2 werkstroom 1 (bug-bash fixes)
- `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md` — bron P0
- `docs/superpowers/plans/2026-04-13-q2-plan-2a-ecd-herstel.md` — zusterplan, loopt parallel of erna

**Branch:** aparte branch `plan-2b-werkbak-audit` voor dit werk. Kan parallel aan 2A als twee ontwikkelaars (of twee sessies) eraan werken; geen overlap in bestanden verwacht behalve mogelijk in `services/ecd/src/routes/taken.ts` wat een conflict-prone file kan zijn.

---

## Waarom discovery-first

De findings-notitie is kort: *"De werkbak lijkt niet te werken en de workflow is ook niet sterk genoeg. Daar moeten we extra aandacht aan besteden."* Dat is een symptoom, geen diagnose. Mogelijke oorzaken zijn zeer verschillend:

- **Flowable niet goed geboot** — demo-processen niet gedeployed of instanties niet gestart
- **workflow-bridge service gebroken** — health check groen maar routes werken niet
- **`/api/taken` retourneert niks** — RBAC filter te strikt, of query naar FHIR Task mist een filter
- **Frontend rendert geen taken** — data komt binnen maar de UI toont ze niet
- **BPMN-modellen onvolledig** — processen starten wel maar produceren geen human-tasks
- **Cross-service data inconsistentie** — ECD maakt een event maar workflow-bridge krijgt het niet
- **"Niet sterk genoeg"** — suggereert dat zelfs waar het *werkt*, de mogelijkheden te beperkt zijn (geen escalatie, geen assignment-rules, geen timer-events)

Elke oorzaak vraagt een compleet andere fix. Eerst onderzoeken, dan fixen. Het plan bestaat uit:
1. **Fase 1 — Audit** (concreet, plannable): stap-voor-stap doorloop van de chain, elk stuk getest, resultaat gedocumenteerd
2. **Fase 2 — Prioritering** (1 taak): op basis van de audit, wat eerst fixen
3. **Fase 3 — Fix** (skelet, detail na audit): de werkelijke fixes worden ingevuld zodra Fase 1 z'n findings oplevert

---

## File Structure

### Aan te maken (tijdens Fase 1)

```
docs/superpowers/findings/
  2026-04-13-werkbak-audit.md       ← alle bevindingen audit, ingevuld tijdens Fase 1
```

### Aan te raken (tijdens Fase 3, afhankelijk van audit)

**Waarschijnlijke kandidaten** (niet zeker):
- `services/workflow-bridge/src/**` — taak-routes, Flowable client, BPMN deploy helpers
- `services/ecd/src/routes/taken.ts` — werkbak-endpoint dat Flowable + FHIR Task combineert
- `apps/web/src/app/werkbak/page.tsx` — frontend rendering
- `apps/web/src/app/werkbak/[id]/page.tsx` — taak-detail
- `infra/flowable/processes/*.bpmn20.xml` — BPMN-modellen (als ze er zijn)
- `infra/scripts/seed.sh` — workflow-seed-gedeelte

---

## Fase 1 — Audit

Zeven onderzoekstaken, elk levert een concrete observatie in `2026-04-13-werkbak-audit.md`. Doel: aan het einde van deze fase weet je exact wáár de chain breekt (en of er meerdere breuken zijn).

### Task 1: Findings-document template + Flowable basis-check

**Files:**
- Create: `docs/superpowers/findings/2026-04-13-werkbak-audit.md`

- [ ] **Step 1.1: Maak het findings-template**

```markdown
# Werkbak + Workflow Audit

**Datum:** 2026-04-XX
**Scope:** Werkbak UI, workflow-bridge service, Flowable engine, FHIR Task flow
**Methode:** chain-of-responsibility walk: elk onderdeel apart testen en resultaat vastleggen

## 1. Flowable-engine
(invullen)

## 2. workflow-bridge service
(invullen)

## 3. Seed: demo-processen en instanties
(invullen)

## 4. `/api/taken` endpoint
(invullen)

## 5. Frontend werkbak-render
(invullen)

## 6. BPMN-modellen kwaliteit
(invullen)

## 7. "Niet sterk genoeg" — feature-gap
(invullen)

## Diagnose

(welke delen van de chain breken, welke prioriteit)

## Aanbevolen fix-volgorde voor Fase 3

(invullen na audit)
```

- [ ] **Step 1.2: Flowable-UI bereikbaar?**

```bash
curl -sS http://192.168.1.10:18080/flowable-rest/service/repository/deployments \
  -u rest-admin:test 2>&1 | head -20
```

Expected: JSON met deployments OR een 401 (auth issue) OR een 000 (service down). Documenteer de echte response in findings "1. Flowable-engine".

Als Flowable-UI/REST niet bereikbaar is, stop hier — de rest van de audit is zinloos zonder Flowable. Escalate: fix Flowable-deployment eerst (mogelijk container niet gestart, verkeerde poort, of credentials mismatch).

- [ ] **Step 1.3: Commit**

```bash
git add docs/superpowers/findings/2026-04-13-werkbak-audit.md
git commit -m "docs(audit): werkbak/workflow audit template + Flowable basis-check"
```

---

### Task 2: workflow-bridge health en routes

- [ ] **Step 2.1: Health check via Unraid-poort**

```bash
curl -sS http://192.168.1.10:14003/health
```

Expected: `{"ok":true,...}` of iets equivalents. Documenteer in findings.

- [ ] **Step 2.2: Enumereer bestaande routes**

```bash
ls services/workflow-bridge/src/routes/
cat services/workflow-bridge/src/app.ts | grep -E "app\.route|mount"
```

Noteer welke routes bestaan (verwacht: templates, processen, taken, health op basis van CLAUDE.md) en welke geregistreerd zijn in `app.ts`.

- [ ] **Step 2.3: Test elk route-endpoint handmatig**

Voor elke route: `curl` met een valid auth-token (gebruik jan@horizon.nl's token, haal via login-endpoint op).

```bash
# Haal token
TOKEN=$(curl -sS -X POST http://192.168.1.10:13000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jan@horizon.nl","password":"Hz!J4n#2026pKw8"}' | jq -r .accessToken)

# Test templates
curl -sS http://192.168.1.10:14003/api/workflow/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: <jan-tenant-id>" | jq

# Herhaal voor processen, taken, ...
```

Documenteer response + status per route. Noteer welke leeg zijn, welke errors geven, welke plausibele data returnen.

- [ ] **Step 2.4: Commit findings-update**

```bash
git commit -m "docs(audit): workflow-bridge routes getest"
```

---

### Task 3: Seed — draaien demo-processen echt?

- [ ] **Step 3.1: Read `infra/scripts/seed.sh` workflow-sectie**

Grep naar "Deploying workflow" en "Starting demo process". Uit de CI-logs van Plan 1 weten we dat dit draait en 5 processes deploys + 13 instances start. Maar draait dat ook op de Unraid stack?

- [ ] **Step 3.2: Verifieer deployments in Flowable**

```bash
curl -sS http://192.168.1.10:18080/flowable-rest/service/repository/deployments \
  -u rest-admin:test | jq
```

Expected: 5 deployments (intake-proces, zorgplan-evaluatie, herindicatie, mic-afhandeling, vaccinatie-campagne).

- [ ] **Step 3.3: Verifieer actieve process-instanties**

```bash
curl -sS http://192.168.1.10:18080/flowable-rest/service/runtime/process-instances \
  -u rest-admin:test | jq '.total, .data | length'
```

Expected: ≥10 actieve instanties (CI maakte er 13).

- [ ] **Step 3.4: Verifieer lopende user tasks**

```bash
curl -sS http://192.168.1.10:18080/flowable-rest/service/runtime/tasks \
  -u rest-admin:test | jq '.total, .data | map({id, name, assignee, taskDefinitionKey})'
```

**Dit is de kritische check.** Als `total == 0`, dan produceren de BPMN-modellen geen human-tasks en is dat de root cause van "werkbak werkt niet" — er is letterlijk niks om te tonen.

- [ ] **Step 3.5: Commit findings-update**

---

### Task 4: `/api/taken` endpoint door twee lagen

Het werkbak-endpoint loopt via twee services: `ecd` heeft `/api/taken` dat via `workflow-bridge` de daadwerkelijke tasks ophaalt (volgens CLAUDE.md).

- [ ] **Step 4.1: Read `services/ecd/src/routes/taken.ts`**

Begrijp de volledige flow: fetched hij van workflow-bridge? Combineert hij met FHIR Task resources? Wat is de filter per tenant/rol?

- [ ] **Step 4.2: Read `services/workflow-bridge/src/routes/taken.ts` (als die bestaat)**

Of waar de werkbak-data vandaan wordt geladen.

- [ ] **Step 4.3: Call `/api/taken` als jan**

```bash
curl -sS http://192.168.1.10:14001/api/taken \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: <jan-tenant-id>" \
  -H "X-User-Role: beheerder" | jq
```

Expected: een lijst met taken. Als leeg → waar breekt het? In de service zelf, of in de upstream call naar workflow-bridge, of in het filter?

- [ ] **Step 4.4: Tail logs tijdens de call**

```bash
# In een tweede terminal:
docker compose -f docker-compose.unraid.yml logs -f ecd workflow-bridge
```

En herhaal de curl. Zie je de request binnenkomen in beide services? Geeft één ervan een error die de ander slikt?

- [ ] **Step 4.5: Commit findings-update**

---

### Task 5: Frontend werkbak-render

- [ ] **Step 5.1: Open `apps/web/src/app/werkbak/page.tsx`**

Lees de complete file. Noteer:
- Welke endpoint wordt gecalled?
- Hoe wordt de data gefilterd / gegroepeerd (op rol? op status?)
- Wat is de "empty state" — wat zie je als er 0 taken zijn?
- Welke acties zijn er beschikbaar (claim, complete, delegate)?

- [ ] **Step 5.2: Test de UI handmatig**

Navigeer als `jan@horizon.nl` naar `/werkbak` op `http://192.168.1.10:13000`. Wat zie je? Leeg? Error? Een lijst die niet klikbaar is?

Maak een screenshot en voeg toe aan `docs/superpowers/findings/screenshots/werkbak-current.png`.

- [ ] **Step 5.3: Check ook `/api/taken` direct in DevTools**

Open DevTools → Network → filter op `taken` → navigeer naar werkbak → zie welke response binnenkomt. Vergelijk met wat de curl uit Task 4.3 teruggaf — matcht het?

- [ ] **Step 5.4: Commit findings-update + screenshot**

---

### Task 6: BPMN-modellen kwaliteit

De BPMN-bestanden staan waarschijnlijk in `infra/flowable/` of als Kotlin/XML strings embedded in `services/workflow-bridge/`.

- [ ] **Step 6.1: Vind de BPMN-bron**

```bash
find . -name "*.bpmn*" 2>/dev/null
grep -r "bpmn20.xml\|userTask\|flowable:formKey" --include="*.ts" services/workflow-bridge/src/ 2>/dev/null | head -20
```

- [ ] **Step 6.2: Voor elk van de 5 processes, open de BPMN (of embedded definitie) en check:**
  - Zit er minimaal 1 `<userTask>` in?
  - Heeft die een `assignee` of `candidateGroups`?
  - Is er een `formKey` of formulier-definitie?
  - Is er een timer-event voor escalatie?
  - Wordt de rol/role per task duidelijk gemapt op een OpenZorg-role?

Documenteer per proces een korte beoordeling: compleet, basis, gebroken.

- [ ] **Step 6.3: Commit findings-update**

---

### Task 7: "Niet sterk genoeg" — feature-gaps

Los van het breekpunt uit Tasks 1-6: welke features missen er om workflows écht bruikbaar te maken in een zorgcontext?

Pak dit aan als een korte brainstorm met kop onderaan het findings-document:

- [ ] **Step 7.1: Lijst mogelijke feature-gaps**

Denk aan:
- Escalatie-regels (niet binnen X uur → herwijzen)
- Groeps-inbox per rol/team vs individuele toewijzing
- Proces-ontwerper in de UI (huidige CLAUDE.md zegt "/admin/workflows/ontwerp" bestaat — werkt die?)
- Notificaties (in-app, email) bij nieuwe task
- SLA-monitoring dashboard
- Batch-acties (meerdere taken tegelijk afhandelen)
- Gekoppelde FHIR resources tonen in taak-detail (welke cliënt hoort bij deze taak, welk zorgplan)
- Audit-log per taak-state-transitie

Voor elk: is het er al? Is het half? Helemaal niet?

- [ ] **Step 7.2: Rangschik op zorg-impact vs implementatie-kosten**

Simpel matrix: hoge impact + lage kosten = eerste fix-kandidaat.

- [ ] **Step 7.3: Commit findings-update**

---

## Fase 2 — Prioritering en fix-lijst

### Task 8: Diagnose schrijven en fix-volgorde bepalen

- [ ] **Step 8.1: Lees het volledige findings-document terug**

Welke onderdelen van de chain breken? Welke zijn prio-1 (blokkerend), welke zijn prio-2 (werkt maar slecht), welke zijn prio-3 (ontbrekende features)?

- [ ] **Step 8.2: Schrijf de "Diagnose" sectie van het findings-document**

Een concrete samenvatting: *"Werkbak werkt niet omdat X, plus Y is zwak, plus Z ontbreekt volledig."*

- [ ] **Step 8.3: Vul "Aanbevolen fix-volgorde voor Fase 3" in**

Lijst van fix-taken, elk met:
- Wat er moet gebeuren (1 zin)
- Waarom het de volgorde heeft die het heeft
- Welke files het raakt
- Geschatte complexiteit (S/M/L)

Dit is letterlijk de input voor Fase 3 die dit plan vervolledigt.

- [ ] **Step 8.4: Commit**

```bash
git commit -m "docs(audit): diagnose + fix-volgorde"
```

- [ ] **Step 8.5: STOP en review**

Dit is een natuurlijk pauze-punt. Het plan kan hier worden stopgezet voor menselijke review van de audit. **Ga niet door naar Fase 3 zonder expliciete goedkeuring van de diagnose en fix-volgorde.** De audit kan ook leiden tot de conclusie "dit is te groot voor dit kwartaal" — in dat geval wordt de scope aangepast.

---

## Fase 3 — Fix (skelet, detail na audit)

**Let op:** deze fase is intentioneel niet in detail uitgeschreven. De stappen worden pas concreet gemaakt wanneer Fase 1 is afgerond en de audit-findings bekend zijn. Dit voorkomt speculatief plannen voor dingen die misschien niet eens de oorzaak zijn.

Onderstaande structuur is een SKELET dat tijdens Fase 2 (Task 8) wordt uitgewerkt tot bite-sized tasks vergelijkbaar met Plan 1 en Plan 2A.

### Task 9: Fix #1 — (in te vullen na audit)
### Task 10: Fix #2 — (in te vullen na audit)
### Task 11: Fix #3 — (in te vullen na audit)
### Task 12: Regressie-tests voor werkbak-flow
### Task 13: PR + merge

---

## Recept per fix-taak (als template voor Fase 3)

Wanneer Fase 2 de fix-lijst oplevert, volgen de taken dit recept:

1. **Regressietest schrijven** die het defect reproduceert
   - Voor backend: Vitest in `services/workflow-bridge/src/__tests__/`
   - Voor frontend: Playwright in `apps/web/tests/e2e/regression/werkbak-*.spec.ts`
2. **Test draaien — verifieer dat hij faalt**
3. **Fix implementeren** — minimale wijziging om test groen te krijgen
4. **Test draaien — moet groen zijn**
5. **Smoke-test** — handmatig de werkbak-UI testen om te bevestigen dat het niet alleen in de test maar ook in echte browsers werkt
6. **Commit** met duidelijke message

Dit is exact hetzelfde recept als Plan 1 en Plan 2A gebruiken. Consistentie is bewust — de subagent-driven-development skill verwacht deze structuur.

---

## Risico's

1. **Audit onthult dat Flowable zelf gaar is.** Dan is fix-werk veel groter dan een bug-fix — mogelijk upgrade, config-overhaul, of zelfs een her-evaluatie van Flowable als keuze. In dat geval: stop, rapporteer aan Kevin, overweeg Plan 2B in te trekken en te vervangen door een bredere "workflow-engine-evaluatie" plan.
2. **BPMN-modellen onvolledig.** Als de processes geen user-tasks produceren, is de fix: BPMN-modellen uitbreiden. Dat is kennis die hier mogelijk ontbreekt — consult met iemand die BPMN kent, of gebruik de Flowable-modeler UI.
3. **Fix-scope wordt >2 weken.** Als de audit onthult dat 3+ systemen samen breken (Flowable + bridge + frontend + BPMN-modellen), dan past dat niet in Q2. Dan wordt Plan 2B gefaseerd of doorgeschoven naar Q3 — maar dat is een gesprek met Kevin, niet een stille scope-creep.
4. **Parallel werk aan Plan 2A veroorzaakt merge-conflicts.** Mitigatie: Plan 2B raakt waarschijnlijk andere files dan Plan 2A. Als er overlap is (`services/ecd/src/routes/taken.ts` is de meest waarschijnlijke), coördineer via een rebase of merge-moment halverwege.
5. **"Werkbak niet sterk genoeg" is subjectief.** Mitigatie: Fase 1 Task 7 maakt het concreet met een feature-gap-lijst. Als een stakeholder (Kevin) andere verwachtingen heeft dan de lijst, bespreek voordat je Fase 3 begint.

---

## Wat hierna komt

**Plan 2A** — ECD herstel loopt parallel of is klaar.

**Plan 3** — Multi-tenant security-review, RBAC uitrol naar planning/facturatie, performance baseline. Kan starten zodra 2A én 2B zijn afgerond.

**Q3** — Kern/sector-scheiding + GRZ-light. De workflow-engine moet tegen die tijd stabiel zijn, anders kan een tweede sector de workflow niet gebruiken.

---

## Waarom dit plan zo kort is

Dit is expliciet een **discovery-plan**, geen implementatie-plan. Fase 1 is concreet en plannable (7 audit-taken, elk met curl-commando's en lees-opdrachten). Fase 3 is een skelet dat pas inhoud krijgt nadat Fase 2 de diagnose heeft opgeleverd.

Dat is precies dezelfde structuur als Plan 1 Task 8 (bug-bash ECD) — je kunt geen bugs fixen die je nog niet kent. De discovery-fase IS het werk; zonder dat is elke plan-detail speculatie.
