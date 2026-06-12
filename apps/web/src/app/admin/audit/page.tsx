"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  path: string;
  details: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

const ACTION_OPTIONS = [
  { value: "", label: "Alle acties" },
  { value: "read", label: "Lezen" },
  { value: "create", label: "Aanmaken" },
  { value: "update", label: "Wijzigen" },
  { value: "delete", label: "Verwijderen" },
];

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (action) params.set("action", action);
    if (user) params.set("user", user);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const { data } = await ecdFetch<AuditResponse>(`/api/admin/audit-log?${params.toString()}`);
    if (data) {
      setEntries(data.entries);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, action, user, from, to]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleFilter() {
    setPage(1);
    void loadData();
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  function actionLabel(a: string): string {
    const map: Record<string, string> = {
      read: "Lezen",
      create: "Aanmaken",
      update: "Wijzigen",
      delete: "Verwijderen",
    };
    return map[a] ?? a;
  }

  function actionColor(a: string): string {
    switch (a) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300";
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-heading font-display font-bold text-fg mb-1">Audit log</h1>
        <p className="text-body-sm text-fg-muted mb-6">
          NEN 7513 compliant logboek van alle toegang tot pati&euml;ntgegevens.
        </p>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl bg-raised p-4 border border-default">
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-from" className="text-caption font-medium text-fg-muted">
              Van
            </label>
            <input
              id="audit-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-body-sm text-fg"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-to" className="text-caption font-medium text-fg-muted">
              Tot
            </label>
            <input
              id="audit-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-body-sm text-fg"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-action" className="text-caption font-medium text-fg-muted">
              Actie
            </label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-body-sm text-fg"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="audit-user" className="text-caption font-medium text-fg-muted">
              Gebruiker
            </label>
            <input
              id="audit-user"
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Zoek op gebruiker-ID"
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-body-sm text-fg w-52"
            />
          </div>
          <button
            onClick={handleFilter}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-body-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Filteren
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-fg-muted py-12 text-center">Laden...</div>
        ) : entries.length === 0 ? (
          <div className="text-fg-muted py-12 text-center">Geen audit logs gevonden.</div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-default">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-default bg-raised">
                    <th className="px-4 py-3 font-medium text-fg-muted">Tijdstip</th>
                    <th className="px-4 py-3 font-medium text-fg-muted">Gebruiker</th>
                    <th className="px-4 py-3 font-medium text-fg-muted">Actie</th>
                    <th className="px-4 py-3 font-medium text-fg-muted">Resource</th>
                    <th className="px-4 py-3 font-medium text-fg-muted">Pad</th>
                    <th className="px-4 py-3 font-medium text-fg-muted text-right">Duur</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-default hover:bg-sunken transition-colors">
                      <td className="px-4 py-2.5 text-fg whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted font-mono text-caption max-w-[10rem] truncate" title={entry.user_id}>
                        {entry.user_id}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-caption font-medium ${actionColor(entry.action)}`}>
                          {actionLabel(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-fg">
                        {entry.resource_type}
                        {entry.resource_id && (
                          <span className="ml-1 text-fg-subtle text-caption">#{entry.resource_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted font-mono text-caption max-w-[16rem] truncate" title={entry.path}>
                        {entry.path}
                      </td>
                      <td className="px-4 py-2.5 text-fg-subtle text-right whitespace-nowrap">
                        {entry.duration_ms != null ? `${entry.duration_ms} ms` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-caption text-fg-muted">
                {total} resultaten &mdash; pagina {page} van {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-default px-3 py-1.5 text-body-sm text-fg hover:bg-sunken transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Vorige
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-default px-3 py-1.5 text-body-sm text-fg hover:bg-sunken transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Volgende
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
