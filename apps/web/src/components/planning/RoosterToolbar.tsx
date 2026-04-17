"use client";

import Link from "next/link";

interface RoosterToolbarProps {
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  weekLabel: string;
}

export function RoosterToolbar({
  weekOffset: _weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
  weekLabel,
}: RoosterToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/planning"
            className="text-sm text-brand-700 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
          >
            &larr; Planning
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-fg">Rooster</h1>
        <p className="text-sm text-fg-muted mt-1">
          {weekLabel}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
          aria-label="Vorige week"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-sunken transition-colors text-fg"
        >
          Vandaag
        </button>
        <button
          onClick={onNextWeek}
          className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
          aria-label="Volgende week"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
