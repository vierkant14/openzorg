# VVT Procescatalogus - OpenZorg

> Laatste update: 2026-04-10
> Dit is een levend document. Status wordt bijgewerkt per sprint.

## Leeswijzer

Deze catalogus beschrijft alle relevante processen binnen VVT-instellingen (Verpleging, Verzorging, Thuiszorg) en de mate waarin OpenZorg deze ondersteunt.

**Statussen:**

| Status | Betekenis |
|--------|-----------|
| Ondersteund | Werkende functionaliteit met API-routes en/of BPMN-workflow |
| Deels ondersteund | Basisfunctionaliteit aanwezig, maar nog niet compleet |
| Gepland | Op de backlog, sprint bekend |
| Niet gestart | Relevant proces, maar nog geen concrete planning |

---

## 1. Instroom

Processen rondom de aanmelding en toelating van clienten.

### 1.1 Intake-proces

- **Beschrijving:** Volledige afhandeling van aanmelding tot opname/start zorg: aanmelding ontvangen, beoordeling door wijkverpleegkundige/casemanager, toetsing indicatie, goedkeuring of afwijzing, opstarten zorgdossier.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 1
- **Technisch:** BPMN-workflow (Flowable). FHIR: Patient, ServiceRequest, Encounter, Task.
- **Opmerkingen:** Workflow bevat aanmelding, beoordeling, goedkeuring/afwijzing stappen.

### 1.2 Clientregistratie

- **Beschrijving:** Vastleggen van clientgegevens: NAW, BSN, verzekering, contactpersonen, huisarts, indicatiegegevens.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 1
- **Technisch:** FHIR Patient resource met BSN-validatie, Address, Coverage (verzekering), RelatedPerson (contactpersonen), CareTeam. Zib-mapping.
- **Opmerkingen:** Volledig formulier met BSN-controle.

### 1.3 Wachtlijstbeheer

- **Beschrijving:** Bijhouden van clienten die wachten op zorgstart, inclusief urgentiebepaling en volgordebewaking.
- **Status:** Deels ondersteund
- **Sprint/release:** Sprint 2
- **Technisch:** FHIR ServiceRequest (status: draft). Wachtlijst als gefilterde view op draft-aanvragen.
- **Opmerkingen:** Basaal aanwezig. Urgentieclassificatie en automatische signalering ontbreken nog.

### 1.4 Indicatieverwerking (CIZ/Wlz)

- **Beschrijving:** Ontvangen en verwerken van CIZ-indicatiebesluiten, koppeling met iWlz/AW319.
- **Status:** Deels ondersteund
- **Sprint/release:** Sprint 1 (handmatige invoer), koppeling gepland
- **Technisch:** FHIR Claim/ClaimResponse (indicatie), ServiceRequest.
- **Opmerkingen:** Handmatige invoer van indicatiegegevens werkt. Geautomatiseerde koppeling met iWlz/CIZ nog niet gebouwd.

### 1.5 Verpleegkundige overdracht (van andere instelling)

- **Beschrijving:** Ontvangen van overdrachtsdossier van verwijzer of vorige zorgaanbieder, inclusief zorginhoudelijke informatie.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Bundle (document), DocumentReference, Composition. eOverdracht-standaard (Nictiz).
- **Opmerkingen:** Vereist implementatie van de Nictiz eOverdracht-standaard. Relevant voor zowel instroom als uitstroom.

---

## 2. Zorglevering

Processen rondom het dagelijks leveren en vastleggen van zorg.

### 2.1 Zorgplanbeheer

- **Beschrijving:** Opstellen, bijwerken en bewaken van het individueel zorgplan per client. Inclusief doelen per leefgebied, interventies en evaluatiemomenten.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 2
- **Technisch:** FHIR CarePlan, Goal (12 leefgebieden), ServiceRequest, Activity. Zib-mapping op zorgleefplan.
- **Opmerkingen:** Volledig CRUD met 12 leefgebieden conform Omaha/zorgleefplan.

### 2.2 Zorgplan-evaluatie / MDO

- **Beschrijving:** Periodieke evaluatie van het zorgplan in multidisciplinair overleg (MDO): voorbereiding, planning, uitvoering MDO, vastlegging conclusies, bijstelling zorgplan.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 2
- **Technisch:** BPMN-workflow (Flowable). FHIR CarePlan (update), Encounter (MDO), ClinicalImpression, Task.
- **Opmerkingen:** Volledige workflow van voorbereiding tot bijstelling.

### 2.3 Rapportage (dagelijkse zorgrapportage)

- **Beschrijving:** Vastleggen van dagelijkse observaties en zorghandelingen per client, in SOEP-structuur of vrije tekst.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 2
- **Technisch:** FHIR Observation (SOEP-categorisering), Encounter. Vrije tekst en gestructureerd.
- **Opmerkingen:** SOEP en vrije-tekst rapportage beiden ondersteund.

### 2.4 Planning en beschikbaarheid

- **Beschrijving:** Inroosteren van zorgmomenten bij clienten, beheren van beschikbaarheid van medewerkers, slotbeheer.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 3
- **Technisch:** FHIR Appointment, Slot, Schedule, Practitioner, PractitionerRole.
- **Opmerkingen:** Basisplanning en beschikbaarheidsbeheer werkt. Zie 5.2 voor geavanceerde roostering.

### 2.5 Documentbeheer

- **Beschrijving:** Uploaden, opslaan en raadplegen van documenten in het clientdossier (brieven, uitslagen, verklaringen, foto's).
- **Status:** Ondersteund
- **Sprint/release:** Sprint 3
- **Technisch:** FHIR Binary (bestandsopslag), DocumentReference (metadata, categorisering).
- **Opmerkingen:** Upload/download werkt. Categorisering en versiebeheer basaal aanwezig.

### 2.6 Medicatiebeheer

- **Beschrijving:** Vastleggen van medicatieoverzicht, medicatieafspraken, toedieningen en signalering van interacties. Koppeling met apotheek (LSP).
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR MedicationRequest, MedicationAdministration, MedicationStatement, MedicationDispense. Zib Medicatie-resources.
- **Opmerkingen:** Kritiek proces voor VVT. Vereist koppeling met LSP/apotheekinformatiesysteem. Hoge prioriteit voor toekomstige sprints.

### 2.7 Voorbehouden en risicovolle handelingen

- **Beschrijving:** Registratie van bekwaamheid en bevoegdheid per medewerker voor voorbehouden handelingen (injecties, katheterisatie, etc.). Vastleggen van opdrachten en uitvoering.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Procedure, PractitionerRole (qualifications), Task (opdracht arts), Provenance.
- **Opmerkingen:** Wettelijk verplichte registratie (Wet BIG). Belangrijk voor intramurale VVT.

### 2.8 Behandelplannen (SO/AVG)

- **Beschrijving:** Medisch behandelplan opgesteld door specialist ouderengeneeskunde (SO) of arts verstandelijk gehandicapten (AVG). Bevat medische diagnoses, behandeldoelen en beleid.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR CarePlan (apart van zorgleefplan), Condition, Procedure, MedicationRequest.
- **Opmerkingen:** Relevant voor intramurale VVT met SO in dienst. Staat naast het zorgleefplan.

### 2.9 Vrijheidsbeperkende maatregelen (VBM)

- **Beschrijving:** Registratie en evaluatie van vrijheidsbeperkende maatregelen conform Wzd (Wet zorg en dwang). Omvat aanvraag, besluit, registratie, periodieke evaluatie en afbouw.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Flag (actieve VBM), Procedure, Consent (wilsverklaring), CarePlan (afbouwplan). Custom BPMN-workflow nodig.
- **Opmerkingen:** Wettelijk verplicht (Wzd). Complexe workflow met meerdere beslismomenten en evaluatietermijnen. Stappenplan vereist.

---

## 3. Kwaliteit en veiligheid

Processen rondom kwaliteitsbewaking, incidentafhandeling en registraties.

### 3.1 MIC-afhandeling (Meldingen Incidenten Clienten)

- **Beschrijving:** Melden, analyseren en afhandelen van incidenten en bijna-incidenten. Ernstbepaling, oorzaakanalyse, maatregelen, evaluatie.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 3
- **Technisch:** BPMN-workflow (Flowable). FHIR DetectedIssue, RiskAssessment, Task.
- **Opmerkingen:** Volledige workflow: analyse, ernstbepaling, maatregelen, evaluatie.

### 3.2 Herindicatie

- **Beschrijving:** Tijdig signaleren van aflopende indicaties, actualiseren gegevens, aanvraag bij CIZ indienen, besluit verwerken in het dossier.
- **Status:** Ondersteund
- **Sprint/release:** Sprint 3
- **Technisch:** BPMN-workflow (Flowable). FHIR ServiceRequest, Claim, Task.
- **Opmerkingen:** Signalering, gegevens actualiseren, CIZ-aanvraag, besluitverwerking.

### 3.3 Kwaliteitsregistraties (zorginhoudelijke indicatoren)

- **Beschrijving:** Periodieke metingen van zorginhoudelijke indicatoren: decubitus, valincidenten, medicijnincidenten, onbedoeld gewichtsverlies, depressie, probleemgedrag. Aanlevering aan Zorginstituut Nederland.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Measure, MeasureReport, Observation (per indicator). Questionnaire/QuestionnaireResponse voor meetinstrumenten.
- **Opmerkingen:** Verplichte jaarlijkse aanlevering voor verpleeghuizen. Vereist gestandaardiseerde meetinstrumenten (bijv. MDS, Cornell, NPI).

### 3.4 Klachtenafhandeling

- **Beschrijving:** Ontvangst, registratie en afhandeling van klachten van clienten en/of naasten conform Wkkgz.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Communication, Task, Flag. BPMN-workflow.
- **Opmerkingen:** Wettelijk verplicht (Wkkgz). Vergelijkbare workflow als MIC, maar met andere betrokkenen en termijnen.

### 3.5 Interne audits

- **Beschrijving:** Planning en uitvoering van interne audits op zorgprocessen, vastleggen bevindingen en verbeteracties.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** Questionnaire/QuestionnaireResponse, Task.
- **Opmerkingen:** Onderdeel kwaliteitsmanagementsysteem. Lage prioriteit voor MVP.

---

## 4. Uitstroom

Processen rondom beeindiging van zorg en overdracht.

### 4.1 Verpleegkundige overdracht (naar andere instelling)

- **Beschrijving:** Samenstellen en versturen van overdrachtsdossier bij verhuizing of overplaatsing naar andere zorgaanbieder.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Composition (overdrachtsbrief), Bundle (document), DocumentReference. eOverdracht-standaard (Nictiz).
- **Opmerkingen:** Nictiz eOverdracht is de landelijke standaard. Zie ook 1.5.

### 4.2 Uitschrijving / zorgeinde

- **Beschrijving:** Administratief afsluiten van het clientdossier bij einde zorg (overlijden, verhuizing, eigen verzoek). Afsluiten zorgplan, laatste rapportage, financiele afwikkeling.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR EpisodeOfCare (status: finished), CarePlan (status: completed), Encounter (discharge).
- **Opmerkingen:** Omvat ook notificatie aan ketenpartners en afsluiting facturatie.

### 4.3 Overlijdensprotocol

- **Beschrijving:** Vastleggen van overlijden, notificatie naasten en huisarts/SO, administratieve afhandeling.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Patient (deceased), Encounter, Communication.
- **Opmerkingen:** Sensitief proces met juridische aspecten (verklaring van overlijden).

---

## 5. Bedrijfsvoering

Ondersteunende processen voor de organisatie.

### 5.1 Facturatie

- **Beschrijving:** Declareren van geleverde zorg richting zorgkantoor (Wlz), zorgverzekeraar (Zvw) of gemeente (Wmo). Omvat productieregistratie, declaratiebestand genereren (AW319/Vektis), retourinformatie verwerken.
- **Status:** Gepland
- **Sprint/release:** Sprint 4
- **Technisch:** FHIR Claim, ClaimResponse, Account, Invoice. Vektis-standaard (AW319/AW320).
- **Opmerkingen:** Backlog sprint 4. Kritiek voor go-live.

### 5.2 Roostering (geavanceerd)

- **Beschrijving:** Volledige roosterplanning: dienstrooster, reistijdoptimalisatie, vakantie/verlof, ruilen van diensten, signalering onderbezetting.
- **Status:** Deels ondersteund
- **Sprint/release:** Sprint 3 (basis), geavanceerd niet gepland
- **Technisch:** FHIR Schedule, Slot, Appointment, PractitionerRole.
- **Opmerkingen:** Basisplanning (2.4) is er. Geavanceerde functies (reistijdoptimalisatie, ruilverzoeken, AZR-normen) ontbreken. Veel instellingen gebruiken externe roosterapps.

### 5.3 Caseload management

- **Beschrijving:** Overzicht en verdeling van clienten over medewerkers, bewaking van caseload-normen, signalering bij overbelasting.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR CareTeam, PractitionerRole, Encounter (workload-berekening). Dashboard/views.
- **Opmerkingen:** Belangrijk voor wijkverpleging. Vereist inzicht in geplande en geleverde uren per medewerker.

### 5.4 Personeelsbeheer (basis)

- **Beschrijving:** Vastleggen van medewerkergegevens, diploma's, BIG-registratie, bekwaamheden.
- **Status:** Deels ondersteund
- **Sprint/release:** Sprint 1 (Practitioner registratie)
- **Technisch:** FHIR Practitioner, PractitionerRole (qualifications, specialties).
- **Opmerkingen:** Basisregistratie van zorgverleners aanwezig. Geen HR-functionaliteit (verlof, salarisadministratie) - dat hoort in een HR-systeem.

### 5.5 Managementinformatie / dashboards

- **Beschrijving:** Stuurinformatie voor management: bezettingsgraad, productiecijfers, ziekteverzuim, kwaliteitsindicatoren.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR Measure, MeasureReport. BI-koppeling of eigen dashboardlaag.
- **Opmerkingen:** Typisch opgelost met BI-tooling (Power BI, Metabase) op de FHIR-database. Niet per se in de applicatie zelf.

### 5.6 Berichtenverkeer (MSZ/ketenintegratie)

- **Beschrijving:** Elektronisch berichtenverkeer met ketenpartners: huisartsen (via Zorgmail/EDIFACT), zorgkantoren, CIZ, gemeenten.
- **Status:** Niet gestart
- **Sprint/release:** -
- **Technisch:** FHIR MessageHeader, Bundle (message), Communication. Integratielaag.
- **Opmerkingen:** Vereist koppelingen met landelijke infrastructuur. Zie ADR-003 voor integratieframework.

### 5.7 Toegangsbeheer / autorisatie

- **Beschrijving:** Beheer van gebruikersrollen, rechten en toegang tot clientgegevens conform NEN 7510.
- **Status:** Deels ondersteund
- **Sprint/release:** Sprint 1
- **Technisch:** Medplum projects (multi-tenancy), FHIR AccessPolicy, Practitioner/PractitionerRole.
- **Opmerkingen:** Multi-tenant met RLS in PostgreSQL. Fijnmazig autorisatiemodel (per client, per team) nog niet uitgewerkt.

---

## Overzichtstabel

| # | Proces | Categorie | Status | Sprint |
|---|--------|-----------|--------|--------|
| 1.1 | Intake-proces | Instroom | Ondersteund | 1 |
| 1.2 | Clientregistratie | Instroom | Ondersteund | 1 |
| 1.3 | Wachtlijstbeheer | Instroom | Deels ondersteund | 2 |
| 1.4 | Indicatieverwerking | Instroom | Deels ondersteund | 1 |
| 1.5 | Verpleegkundige overdracht (in) | Instroom | Niet gestart | - |
| 2.1 | Zorgplanbeheer | Zorglevering | Ondersteund | 2 |
| 2.2 | Zorgplan-evaluatie / MDO | Zorglevering | Ondersteund | 2 |
| 2.3 | Rapportage | Zorglevering | Ondersteund | 2 |
| 2.4 | Planning en beschikbaarheid | Zorglevering | Ondersteund | 3 |
| 2.5 | Documentbeheer | Zorglevering | Ondersteund | 3 |
| 2.6 | Medicatiebeheer | Zorglevering | Niet gestart | - |
| 2.7 | Voorbehouden handelingen | Zorglevering | Niet gestart | - |
| 2.8 | Behandelplannen (SO/AVG) | Zorglevering | Niet gestart | - |
| 2.9 | Vrijheidsbeperkende maatregelen | Zorglevering | Niet gestart | - |
| 3.1 | MIC-afhandeling | Kwaliteit | Ondersteund | 3 |
| 3.2 | Herindicatie | Kwaliteit | Ondersteund | 3 |
| 3.3 | Kwaliteitsregistraties | Kwaliteit | Niet gestart | - |
| 3.4 | Klachtenafhandeling | Kwaliteit | Niet gestart | - |
| 3.5 | Interne audits | Kwaliteit | Niet gestart | - |
| 4.1 | Verpleegkundige overdracht (uit) | Uitstroom | Niet gestart | - |
| 4.2 | Uitschrijving / zorgeinde | Uitstroom | Niet gestart | - |
| 4.3 | Overlijdensprotocol | Uitstroom | Niet gestart | - |
| 5.1 | Facturatie | Bedrijfsvoering | Gepland | 4 |
| 5.2 | Roostering (geavanceerd) | Bedrijfsvoering | Deels ondersteund | 3+ |
| 5.3 | Caseload management | Bedrijfsvoering | Niet gestart | - |
| 5.4 | Personeelsbeheer | Bedrijfsvoering | Deels ondersteund | 1 |
| 5.5 | Managementinformatie | Bedrijfsvoering | Niet gestart | - |
| 5.6 | Berichtenverkeer | Bedrijfsvoering | Niet gestart | - |
| 5.7 | Toegangsbeheer | Bedrijfsvoering | Deels ondersteund | 1 |

**Totaal:** 27 processen | 10 ondersteund | 5 deels ondersteund | 1 gepland | 11 niet gestart

---

## Prioritering niet-gestarte processen

Op basis van wettelijke verplichting, operationele impact en MVP-relevantie:

1. **Facturatie** (5.1) - Gepland sprint 4. Zonder facturatie geen inkomsten.
2. **Medicatiebeheer** (2.6) - Clientveiligheid. Groot deel van de VVT-zorg draait om medicatie.
3. **Vrijheidsbeperkende maatregelen** (2.9) - Wettelijk verplicht (Wzd). Inspectie controleert actief.
4. **Voorbehouden handelingen** (2.7) - Wettelijk verplicht (Wet BIG).
5. **Kwaliteitsregistraties** (3.3) - Verplichte aanlevering aan Zorginstituut.
6. **Verpleegkundige overdracht** (1.5/4.1) - Nictiz eOverdracht wordt landelijk uitgerold.
7. **Uitschrijving** (4.2) - Nodig voor complete levenscyclus.
8. **Caseload management** (5.3) - Operationeel belangrijk, vooral wijkverpleging.
9. **Behandelplannen** (2.8) - Relevant voor intramurale settings met SO.
10. **Klachtenafhandeling** (3.4) - Wettelijk verplicht (Wkkgz), maar laag-volume.
11. **Berichtenverkeer** (5.6) - Afhankelijk van landelijke infra, lange doorlooptijd.
