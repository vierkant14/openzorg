"use client";

import { ErrorState, LoadingSkeleton, PageHeader, Section } from "@openzorg/shared-ui";
import { useEffect, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { ecdFetch } from "../../../../lib/api";

import { RegelEditor } from "./RegelEditor";
import { RegelsLijst } from "./RegelsLijst";
import { VeldEditor } from "./VeldEditor";
import { VeldenLijst } from "./VeldenLijst";
import type { CustomField, ValidationRule } from "./types";

/**
 * Configuratie van custom velden en validatieregels.
 * Dunne container: laadt de data, houdt lijst-state bij en stelt de
 * secties samen; tabellen en formulieren leven in losse componenten.
 */
export default function ConfiguratiePage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  async function loadFields() {
    setFieldsLoading(true);
    const { data, error } = await ecdFetch<{ customFields: CustomField[] }>(
      "/api/admin/custom-fields",
    );
    setFields(data?.customFields ?? []);
    setFieldsError(error);
    setFieldsLoading(false);
  }

  async function loadRules() {
    setRulesLoading(true);
    const { data, error } = await ecdFetch<{ validationRules: ValidationRule[] }>(
      "/api/admin/validation-rules",
    );
    setRules(data?.validationRules ?? []);
    setRulesError(error);
    setRulesLoading(false);
  }

  useEffect(() => {
    loadFields();
    loadRules();
  }, []);

  async function handleToggleField(id: string, actief: boolean) {
    const { error } = await ecdFetch(`/api/admin/custom-fields/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !actief }),
    });
    if (error) {
      setFieldsError(error);
      return;
    }
    await loadFields();
  }

  async function handleDeleteField(id: string) {
    const { error } = await ecdFetch(`/api/admin/custom-fields/${id}`, {
      method: "DELETE",
    });
    if (error) {
      setFieldsError(error);
      return;
    }
    await loadFields();
  }

  async function handleDeleteRule(id: string) {
    const { error } = await ecdFetch(`/api/admin/validation-rules/${id}`, {
      method: "DELETE",
    });
    if (error) {
      setRulesError(error);
      return;
    }
    await loadRules();
  }

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <a
          href="/dashboard"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug
        </a>

        <PageHeader
          titel="Configuratie"
          omschrijving="Beheer custom velden en validatieregels per resourcetype."
        />

        <Section titel="Custom velden">
          <div className="space-y-6">
            {fieldsError && <ErrorState melding={fieldsError} onOpnieuw={loadFields} />}
            {fieldsLoading ? (
              <LoadingSkeleton regels={4} />
            ) : (
              <VeldenLijst
                velden={fields}
                onToggle={handleToggleField}
                onVerwijder={handleDeleteField}
              />
            )}
            <VeldEditor onToegevoegd={loadFields} />
          </div>
        </Section>

        <Section titel="Validatieregels">
          <div className="space-y-6">
            {rulesError && <ErrorState melding={rulesError} onOpnieuw={loadRules} />}
            {rulesLoading ? (
              <LoadingSkeleton regels={4} />
            ) : (
              <RegelsLijst regels={rules} onVerwijder={handleDeleteRule} />
            )}
            <RegelEditor onToegevoegd={loadRules} />
          </div>
        </Section>
      </main>
    </AppShell>
  );
}
