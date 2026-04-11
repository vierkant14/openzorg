"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ---------- Types ---------- */

interface FhirReference {
  reference?: string;
}

interface FhirTelecom {
  system?: string;
  value?: string;
}

interface FhirAddress {
  text?: string;
}

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface Organization {
  id: string;
  resourceType: "Organization";
  active?: boolean;
  name?: string;
  partOf?: FhirReference;
  type?: Array<{ coding?: FhirCoding[] }>;
  telecom?: FhirTelecom[];
  address?: FhirAddress[];
}

interface OrganizationBundle {
  entry?: Array<{ resource: Organization }>;
}

interface OrgTreeNode {
  org: Organization;
  children: OrgTreeNode[];
}

const LOCATIE_TYPES = ["verpleeghuis", "thuiszorg-team", "kantoor"] as const;

/* ---------- Helpers ---------- */

function buildTree(orgs: Organization[]): OrgTreeNode[] {
  const nodeMap = new Map<string, OrgTreeNode>();
  const roots: OrgTreeNode[] = [];

  for (const org of orgs) {
    nodeMap.set(org.id, { org, children: [] });
  }

  for (const org of orgs) {
    const node = nodeMap.get(org.id);
    if (!node) continue;

    const parentRef = org.partOf?.reference;
    if (parentRef) {
      const parentId = parentRef.replace("Organization/", "");
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        parentNode.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}

function getLocatieType(org: Organization): string {
  return org.type?.[0]?.coding?.[0]?.code ?? "";
}

function getTelefoon(org: Organization): string {
  return org.telecom?.find((t) => t.system === "phone")?.value ?? "";
}

function getAdres(org: Organization): string {
  return org.address?.[0]?.text ?? "";
}

/* ---------- Page ---------- */

export default function OrganisatiePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [naam, setNaam] = useState("");
  const [adres, setAdres] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [type, setType] = useState<string>(LOCATIE_TYPES[0]);
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadOrganisaties() {
    setLoading(true);
    const { data, error: err } = await ecdFetch<OrganizationBundle>("/api/organisatie");
    const orgs = data?.entry?.map((e) => e.resource) ?? [];
    setOrganizations(orgs);
    setError(err);
    setLoading(false);
  }

  useEffect(() => {
    loadOrganisaties();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: err } = await ecdFetch("/api/organisatie/locaties", {
      method: "POST",
      body: JSON.stringify({
        naam,
        adres: adres || undefined,
        telefoon: telefoon || undefined,
        type,
        parentId,
      }),
    });

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }

    setNaam("");
    setAdres("");
    setTelefoon("");
    setType(LOCATIE_TYPES[0]);
    setParentId("");
    await loadOrganisaties();
  }

  const tree = buildTree(organizations);

  const inputClass =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  const btnPrimary =
    "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <a
          href="/dashboard"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug
        </a>

        <h2 className="text-2xl font-bold text-fg">Organisatie</h2>

        {error && (
          <div className="p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm">
            {error}
          </div>
        )}

        {/* ============ BOOMSTRUCTUUR ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Organisatiestructuur
          </h3>

          {loading ? (
            <p className="text-sm text-fg-subtle">Laden...</p>
          ) : tree.length === 0 ? (
            <p className="text-sm text-fg-subtle">
              Nog geen organisaties gevonden.
            </p>
          ) : (
            <div className="space-y-1">
              {tree.map((node) => (
                <TreeNode key={node.org.id} node={node} depth={0} />
              ))}
            </div>
          )}
        </section>

        {/* ============ LOCATIE TOEVOEGEN ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Locatie toevoegen
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Naam
                </label>
                <input
                  type="text"
                  required
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="Locatie Zuid"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Bovenliggende organisatie
                </label>
                <select
                  required
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecteer...</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name ?? o.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputClass}
                >
                  {LOCATIE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Adres
                </label>
                <input
                  type="text"
                  value={adres}
                  onChange={(e) => setAdres(e.target.value)}
                  placeholder="Hoofdstraat 1, Amsterdam"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={telefoon}
                  onChange={(e) => setTelefoon(e.target.value)}
                  placeholder="020-1234567"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !parentId}
                className={btnPrimary}
              >
                {saving ? "Opslaan..." : "Locatie toevoegen"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}

/* ---------- Tree component ---------- */

function TreeNode({ node, depth }: { node: OrgTreeNode; depth: number }) {
  const org = node.org;
  const locType = getLocatieType(org);
  const tel = getTelefoon(org);
  const addr = getAdres(org);

  return (
    <div>
      <div
        className="flex items-center gap-3 py-2 px-3 rounded hover:bg-sunken"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <span className="text-fg-subtle">
          {depth === 0 ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm text-fg">
            {org.name ?? "(naamloos)"}
          </span>
          <div className="flex items-center gap-3 text-xs text-fg-subtle">
            {locType && <span>{locType}</span>}
            {addr && <span>{addr}</span>}
            {tel && <span>{tel}</span>}
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            org.active !== false
              ? "bg-brand-50 text-brand-700"
              : "bg-gray-100 text-fg-subtle"
          }`}
        >
          {org.active !== false ? "Actief" : "Inactief"}
        </span>
      </div>
      {node.children.map((child) => (
        <TreeNode key={child.org.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
