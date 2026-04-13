# Revalidatie/GRZ Module — Processen & Flows

**Status:** Gepland (deels overlappend met VVT)
**Financiering:** ZVW (DBC-systematiek)
**Doelgroep:** Kwetsbare ouderen na acute aandoening (heupfractuur, CVA, hartfalen)

---

## Verschil VVT vs. GRZ

| Aspect | VVT | GRZ |
|--------|-----|-----|
| Aard | Langdurig, onderhoudsgericht | Tijdelijk, herstelgericht |
| Doel | Kwaliteit van leven behouden | Functioneel herstel, terugkeer naar huis |
| Regie | EVV / wijkverpleegkundige | Specialist ouderengeneeskunde (SO) |
| Methodiek | Leefgebieden (Omaha) | ICF-model |
| Duur | Maanden tot jaren | 6-8 weken (max 6 maanden) |
| Facturatie | WLZ/WMO/ZVW per uur/dag | DBC zorgproduct |

---

## Procesflow

```
INSTROOM           BEHANDELING              ONTSLAG
────────           ───────────              ───────

Verwijzing →       Dagelijkse therapie →    Eindevaluatie
ziekenhuis             ↓                        ↓
    ↓              Meetmomenten →          Ontslagplanning
Screening          (FIM, Barthel)               ↓
    ↓                  ↓                   Proefverlof
Opname             Wekelijks teamoverleg        ↓
    ↓                  ↓                   Overdracht
Functionele        Midterm evaluatie            ↓
 diagnostiek           ↓                   Nazorg (6 wkn)
    ↓              Bijstelling
ICF-classificatie      ↓
    ↓              Doelgerichte revalidatie
Behandelplan       (6-8 weken)
    ↓
Doelen SMART
```

---

## Meetinstrumenten

| Instrument | Afkorting | Meet | Score | Frequentie |
|-----------|-----------|------|-------|------------|
| Barthel Index | BI | ADL | 0-20 | Opname, tussentijds, ontslag |
| FIM | FIM | Functioneel | 18-126 | Opname, tussentijds, ontslag |
| Timed Up and Go | TUG | Mobiliteit | Seconden | Wekelijks |
| Berg Balance | BBS | Evenwicht | 0-56 | 2-wekelijks |
| 6 Minute Walk | 6MWT | Uithoudingsvermogen | Meters | 2-wekelijks |
| MoCA | MoCA | Cognitie | 0-30 | Opname, ontslag |
| NRS Pijn | NRS | Pijn | 0-10 | Dagelijks |

---

## Gedeeld met VVT

Clientregistratie, signaleringen, medicatiebeheer, rapportage, overdracht, workflow engine — allemaal herbruikbaar.

## Nieuw te bouwen

| Component | Prioriteit |
|-----------|-----------|
| Behandelplan (ICF-model) | P1 |
| Meetinstrumenten (Questionnaire + scoring) | P1 |
| CareTeam per client | P2 |
| DBC-registratie | P2 |
| Proefverlof + nazorg | P3 |
