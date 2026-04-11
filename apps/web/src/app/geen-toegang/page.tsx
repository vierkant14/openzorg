"use client";

import AppShell from "../../components/AppShell";

export default function GeenToegangPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-20 h-20 rounded-2xl bg-coral-50 dark:bg-coral-950/30 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-coral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        </div>
        <h1 className="text-display-md text-fg font-display mb-2">Geen toegang</h1>
        <p className="text-body text-fg-muted text-center max-w-md mb-8">
          Je hebt niet de juiste rechten om deze pagina te bekijken.
          Neem contact op met je beheerder als je denkt dat dit niet klopt.
        </p>
        <div className="flex gap-3">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            Naar dashboard
          </a>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 text-body-sm font-medium text-fg-muted border border-default rounded-xl hover:bg-sunken transition-colors"
          >
            Terug
          </button>
        </div>
      </div>
    </AppShell>
  );
}
