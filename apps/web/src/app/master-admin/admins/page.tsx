"use client";

import { useEffect, useState } from "react";

import { masterFetch } from "../../../lib/master-api";

interface MasterAdmin {
  id: string;
  email: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export default function MasterAdminsPage() {
  const [admins, setAdmins] = useState<MasterAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAdmins() {
    setLoading(true);
    const res = await masterFetch<{ admins: MasterAdmin[] }>("/api/master/admins");
    if (res.data) {
      setAdmins(res.data.admins);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const res = await masterFetch<MasterAdmin>("/api/master/admins", {
      method: "POST",
      body: JSON.stringify({ email: newEmail, name: newName }),
    });

    if (res.data) {
      setNewEmail("");
      setNewName("");
      await loadAdmins();
    } else {
      setFormError(res.error);
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Weet je zeker dat je ${name} wilt verwijderen als master admin?`)) {
      return;
    }

    const res = await masterFetch(`/api/master/admins/${id}`, { method: "DELETE" });
    if (res.error) {
      setError(res.error);
    } else {
      await loadAdmins();
    }
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500">
                <span className="font-display text-sm font-extrabold text-white tracking-tight">OZ</span>
              </div>
              <div>
                <h1 className="font-display text-heading font-bold tracking-tight">Master Admins</h1>
                <p className="text-body-sm text-navy-300">Beheer platformbeheerders</p>
              </div>
            </div>
            <a
              href="/master-admin"
              className="inline-flex items-center gap-2 px-4 py-2 text-navy-300 text-body-sm font-medium rounded-xl hover:text-white hover:bg-navy-800 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Terug naar overzicht
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-6 lg:px-10 py-8">
        {/* Add form */}
        <div className="bg-raised rounded-2xl border border-default p-6 shadow-soft mb-8">
          <h2 className="text-heading text-fg mb-4">Admin toevoegen</h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="admin-name" className="block text-body-sm font-medium text-fg mb-1.5">
                Naam
              </label>
              <input
                id="admin-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="Volledige naam"
                className="w-full border border-default bg-raised rounded-xl px-4 py-2.5 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="admin-email" className="block text-body-sm font-medium text-fg mb-1.5">
                E-mailadres
              </label>
              <input
                id="admin-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="naam@openzorg.nl"
                className="w-full border border-default bg-raised rounded-xl px-4 py-2.5 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-soft whitespace-nowrap"
              >
                {submitting ? "Toevoegen..." : "Toevoegen"}
              </button>
            </div>
          </form>
          {formError && (
            <div className="mt-3 rounded-xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-3 text-body-sm text-coral-700 dark:text-coral-300">
              {formError}
            </div>
          )}
        </div>

        {/* Admins list */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-body-sm text-fg-muted">Admins laden...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-6 mb-6">
            <p className="text-body-sm text-coral-700 dark:text-coral-300">{error}</p>
          </div>
        )}

        {!loading && !error && admins.length > 0 && (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Naam</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">E-mailadres</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden sm:table-cell">Aangemaakt</th>
                  <th className="text-right px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Acties</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-subtle last:border-0">
                    <td className="px-6 py-4 font-semibold text-fg">{admin.name}</td>
                    <td className="px-6 py-4 text-fg-muted">{admin.email}</td>
                    <td className="px-6 py-4 text-caption text-fg-subtle hidden sm:table-cell">
                      {new Date(admin.created_at).toLocaleDateString("nl-NL", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(admin.id, admin.name)}
                        disabled={admins.length <= 1}
                        className="text-body-sm text-coral-600 dark:text-coral-400 hover:text-coral-700 dark:hover:text-coral-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-subtle">
              <p className="text-caption text-fg-subtle">{admins.length} {admins.length === 1 ? "admin" : "admins"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
