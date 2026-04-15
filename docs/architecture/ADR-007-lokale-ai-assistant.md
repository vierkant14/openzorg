# ADR-007: Lokale AI-assistent via Ollama

**Status:** Accepted
**Datum:** 2026-04-15
**Besluitnemers:** Stichting OpenZorg

## Context

AI-assistenten (LLM's) kunnen substantieel tijd besparen in zorgprocessen:
dagoverdracht-samenvattingen, signaal-detectie in vrije tekst, intake-ondersteuning,
SNOMED/ICD-codering, rapportage-analyse. Tegelijk vereist de zorg dat cliëntdata
het netwerk van de instelling niet verlaat — privacy (AVG), medisch beroepsgeheim
(Wgbo) en informatiebeveiliging (NEN 7510, NEN 7513).

Commerciële LLM-API's (OpenAI, Anthropic, Google) zijn krachtig maar vereisen
dat prompts + context de cloud in gaan. Voor Nederlandse zorg is dat een
juridisch en ethisch obstakel dat per instelling een DPIA vereist en vaak
leidt tot een nee.

## Overwogen alternatieven

1. **Commerciële API's (OpenAI, Anthropic, Azure OpenAI NL-region)** — beste
   modelkwaliteit, maar data verlaat het netwerk. Vereist DPIA per klant,
   contractuele data-processing agreements, en bij een datalek is het
   aansprakelijkheidspad onduidelijk. Afgewezen.

2. **Managed inference-platforms (Replicate, HuggingFace Inference)** — zelfde
   fundamentele probleem als commerciële API's. Afgewezen.

3. **Eigen model-training** — te duur, te traag, en onnodig omdat er
   uitstekende open-weight modellen bestaan. Afgewezen.

4. **Lokale Ollama-runtime met open-weight modellen (Gemma, Llama, Qwen, Mistral,
   eventueel MedGemma)** — data blijft op de server, model draait CPU (klein)
   of GPU (groter), en de modelkeuze is per tenant configureerbaar. **Gekozen.**

## Besluit

OpenZorg integreert met **Ollama** als default LLM-runtime. Ollama draait als
aparte container naast de ECD-service. De ECD-service bevat een dunne client
(`services/ecd/src/lib/ollama-client.ts`) en endpoints onder `/api/ai/*` met:

- **Tenant-scoped modelkeuze** — per tenant wordt in `openzorg.tenant_configurations`
  met `config_type='ai_model'` opgeslagen welk Ollama-model gebruikt wordt. Default
  is `gemma3:4b` (klein, redelijk Nederlands, CPU-haalbaar).
- **NEN 7513 audit-logging** — elke AI-aanroep wordt met user-id, model, prompt-lengte,
  tenant-id en duur in `openzorg.audit_log` vastgelegd. Prompts zelf worden niet
  letterlijk opgeslagen in de audit-log (zou extreem groot worden), maar de metadata
  is genoeg om te kunnen reconstrueren wie wanneer voor welke cliënt AI heeft bevraagd.
- **RBAC** — AI-endpoints vallen onder dezelfde middleware-chain als overige
  `/api/*` routes: tenant → rbac → audit.
- **Optioneel** — Ollama draait in een apart Docker Compose profile (`ai`), zodat
  kleinere tenants zonder AI-capaciteit de service simpelweg uit kunnen laten.
- **Geen externe API's** — de client ondersteunt alleen Ollama's HTTP-interface.
  Er is bewust geen fallback naar OpenAI/Anthropic om het "data blijft lokaal"
  principe onmogelijk te breken.

## Endpoints (v1 skeleton)

- `GET /api/ai/health` — Ollama bereikbaar? Welke modellen geladen?
- `GET /api/ai/models` — lijst van beschikbare modellen op de server
- `GET /api/ai/config` — welk model gebruikt deze tenant?
- `PUT /api/ai/config` — set model-voorkeur voor deze tenant
- `POST /api/ai/ask` — algemene prompt → antwoord (voor beheerders, tests)
- `POST /api/ai/summarize-rapportages` — samenvat een reeks rapportages
  (doel: dagoverdracht / weekoverzicht / mdo-voorbereiding)

Toekomstige productie-endpoints (met vaste system prompts):
- `POST /api/ai/suggest-codes` — SNOMED/ICD voorstellen bij vrije-tekst diagnose
- `POST /api/ai/detect-signals` — scan vrije tekst op rode vlaggen
- `POST /api/ai/intake-assist` — concept-zorgplan op basis van indicatie + anamnese
- `POST /api/ai/draft-correspondence` — conceptbrieven voor huisarts/ziekenhuis

## Gevolgen

**Positief:**
- Data verlaat nooit het netwerk → geen DPIA-hoofdpijn per klant
- Per tenant vrij te kiezen welk model (Gemma3, Llama3.1, Qwen2.5, MedGemma, ...)
- Gratis: geen per-token kosten
- Volledig in lijn met het open-source / transparantie-verhaal van OpenZorg

**Negatief:**
- Kwaliteit kleinere open-weight modellen is (vooralsnog) minder dan GPT-4 class.
  Voor feitelijke samenvattingen voldoende, voor complex reasoning nog zwak.
- GPU-hardware maakt output significant beter + sneller. Instellingen zonder GPU
  zijn beperkt tot 3B-7B parameter modellen op CPU.
- Eerste model-download kost bandbreedte (Gemma3:4b ≈ 3GB, Llama3.1:8b ≈ 5GB).
- Beheerteam moet model-updates handmatig triggeren (`ollama pull`).

## Privacy-garanties die we aan gebruikers communiceren

1. **Prompts en context blijven binnen je eigen netwerk** — Ollama draait op
   dezelfde Docker-host als de ECD-service, er is geen uitgaand verkeer.
2. **Data-audit** — elke AI-aanroep is terug te vinden in de NEN 7513 audit-log
   (wie, wanneer, voor welke cliënt, welk doel).
3. **Opt-in per tenant** — als je tenant geen AI-module activeert, wordt de
   `/api/ai/*` endpoint-groep niet aangesproken.
4. **Modelkeuze is vrij** — wil je juist MedGemma (medisch gefinetuned)? Of
   een Nederlands-dominerend model? Je kiest zelf wat je pulllt en gebruikt.

## Referenties

- [Ollama documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [MedGemma (Google DeepMind, 2025)](https://blog.google/technology/health/medgemma/)
- NEN 7513:2018 — Logging van handelingen met persoonsgegevens in de zorg
- NEN 7510:2017 — Informatiebeveiliging in de zorg
