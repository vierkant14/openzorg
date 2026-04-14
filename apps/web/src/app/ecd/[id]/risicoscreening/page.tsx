"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  Gededupliceerd van monolith tijdens Plan 2A Task 4 migratie               */
/* -------------------------------------------------------------------------- */

const SCREENING_TYPES = [
  { value: "Valrisico (Morse Fall Scale)", label: "Valrisico" },
  { value: "Decubitus (Braden)", label: "Decubitus" },
  { value: "Ondervoeding (SNAQ/MUST)", label: "Ondervoeding" },
  { value: "Depressie (GDS-15)", label: "Depressie" },
  { value: "Pijn (NRS/VAS)", label: "Pijn" },
  { value: "Delier (DOS/DOSS)", label: "Delier" },
];


const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];


function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}


function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}


function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
}

interface FhirRelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  name?: Array<{ family?: string; given?: string[] }>;
  telecom?: Array<{ system?: string; value?: string }>;
  relationship?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
}

interface FhirRelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  name?: Array<{ family?: string; given?: string[] }>;
  telecom?: Array<{ system?: string; value?: string }>;
  relationship?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirRelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  name?: Array<{ family?: string; given?: string[] }>;
  telecom?: Array<{ system?: string; value?: string }>;
  relationship?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Overzicht" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "toediening", label: "Toediening" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "vragenlijsten", label: "Vragenlijsten" },
  { key: "mdo", label: "MDO" },
  { key: "vbm", label: "VBM" },
  { key: "wilsverklaringen", label: "Wilsverklaring" },
  { key: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface FhirRiskAssessment {
  id?: string;
  code?: { text?: string };
  status?: string;
  occurrenceDateTime?: string;
  prediction?: Array<{ outcome?: { text?: string }; qualitativeRisk?: { text?: string }; relativeRisk?: number }>;
  note?: Array<{ text?: string }>;
}

const SCREENING_TYPES = [
  { value: "Valrisico (Morse Fall Scale)", label: "Valrisico" },
  { value: "Decubitus (Braden)", label: "Decubitus" },


type TabKey = "dashboard" | "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "vaccinaties" | "diagnoses" | "risicoscreenings" | "toediening" | "vragenlijsten" | "mdo" | "vbm" | "wilsverklaringen" | "medicatie-overzicht" | "documenten" | "extra";


/* -------------------------------------------------------------------------- */
/*  Tab content                                                               */
/* -------------------------------------------------------------------------- */

function RisicoscreeningsTabInner({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [screeningType, setScreeningType] = useState(SCREENING_TYPES[0]?.value ?? "");
  const [risico, setRisico] = useState("laag");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirRiskAssessment>>(`/api/clients/${clientId}/risicoscreenings`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/risicoscreenings`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: screeningType },
        occurrenceDateTime: new Date().toISOString(),
        prediction: [{ qualitativeRisk: { text: risico } }],
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNotitie("");
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Risicoscreenings</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Screening"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          <select value={screeningType} onChange={(e) => setScreeningType(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            {SCREENING_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.value}</option>)}
          </select>
          <select value={risico} onChange={(e) => setRisico(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            <option value="laag">Laag risico</option>
            <option value="matig">Matig risico</option>
            <option value="hoog">Hoog risico</option>
            <option value="zeer hoog">Zeer hoog risico</option>
          </select>
          <textarea placeholder="Toelichting (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Screening opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen risicoscreenings uitgevoerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const risicoNiveau = r.prediction?.[0]?.qualitativeRisk?.text ?? "onbekend";
            const isHoog = risicoNiveau === "hoog" || risicoNiveau === "zeer hoog";
            return (
              <div key={r.id} className="bg-raised rounded-xl border border-default p-4">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-fg">{r.code?.text ?? "Screening"}</p>
                  <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                    isHoog ? "bg-coral-50 text-coral-600" : "bg-brand-50 text-brand-700"
                  }`}>
                    {risicoNiveau}
                  </span>
                </div>
                {r.occurrenceDateTime && (
                  <p className="text-caption text-fg-subtle mt-1">
                    Uitgevoerd op {new Date(r.occurrenceDateTime).toLocaleDateString("nl-NL")}
                  </p>
                )}
                {r.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{r.note[0].text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function RisicoscreeningPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  return <RisicoscreeningsTabInner clientId={clientId} />;
}

