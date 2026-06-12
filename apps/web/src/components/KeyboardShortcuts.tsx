"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Shortcut {
  keys: string;
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl+.", label: "AI Chat openen/sluiten" },
  { keys: "?", label: "Sneltoetsen tonen" },
  { keys: "g c", label: "Ga naar Clienten" },
  { keys: "g p", label: "Ga naar Planning" },
  { keys: "g d", label: "Ga naar Dashboard" },
  { keys: "g w", label: "Ga naar Werkbak" },
  { keys: "/", label: "Focus zoekbalk" },
  { keys: "Esc", label: "Sluit modals" },
];

const NAV_MAP: Record<string, string> = {
  c: "/ecd",
  p: "/planning",
  d: "/dashboard",
  w: "/werkbak",
};

/**
 * Keyboard shortcuts system.
 *
 * - `?` opens/closes the shortcuts modal
 * - `g` then a letter within 500ms navigates (g c, g p, g d, g w)
 * - `/` focuses the search bar if present
 * - `Esc` closes the modal
 *
 * Mount once inside AppShell.
 */
export function useKeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when user is typing in an input/textarea/contentEditable
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if (isEditable) return;

      // Esc closes modal
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      // ? toggles shortcuts modal
      if (e.key === "?") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      // / focuses search bar
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-search-input], input[type="search"], input[placeholder*="Zoek"]',
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      // g-then-letter navigation
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        gPressedRef.current = true;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        gTimerRef.current = setTimeout(() => {
          gPressedRef.current = false;
        }, 500);
        return;
      }

      if (gPressedRef.current) {
        const dest = NAV_MAP[e.key];
        if (dest) {
          e.preventDefault();
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          window.location.href = dest;
        }
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { open, setOpen };
}

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-950/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-default bg-raised p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-fg">Sneltoetsen</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-fg-muted hover:text-fg hover:bg-sunken transition-colors"
            aria-label="Sluiten"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-fg-muted">{shortcut.label}</span>
              <div className="flex gap-1">
                {shortcut.keys.split("+").length > 1
                  ? shortcut.keys.split("+").map((key) => (
                      <kbd
                        key={key}
                        className="inline-flex items-center justify-center rounded-md border border-default bg-sunken px-2 py-0.5 text-xs font-mono text-fg-muted"
                      >
                        {key}
                      </kbd>
                    ))
                  : shortcut.keys.split(" ").map((key) => (
                      <kbd
                        key={key}
                        className="inline-flex items-center justify-center rounded-md border border-default bg-sunken px-2 py-0.5 text-xs font-mono text-fg-muted"
                      >
                        {key}
                      </kbd>
                    ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-fg-subtle text-center">
          Druk op <kbd className="rounded border border-default bg-sunken px-1.5 py-0.5 text-[10px] font-mono">Esc</kbd> om te sluiten
        </p>
      </div>
    </div>
  );
}

/**
 * Small floating help button (bottom-right) that opens the shortcuts modal.
 */
export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-default bg-raised text-fg-muted shadow-lg hover:bg-sunken hover:text-fg transition-colors"
      title="Sneltoetsen (?)"
      aria-label="Sneltoetsen tonen"
    >
      <span className="text-sm font-bold">?</span>
    </button>
  );
}
