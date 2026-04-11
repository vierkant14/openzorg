"use client";

import { useEffect } from "react";

import { isLoggedIn } from "../lib/api";

export default function HomePage() {
  useEffect(() => {
    if (isLoggedIn()) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
        <p className="text-body-sm text-fg-muted">Laden...</p>
      </div>
    </div>
  );
}
