"use client";

import { useEffect, useRef, useState } from "react";

import { masterFetch } from "../lib/master-api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  medplum_project_id: string;
  status: string;
}

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const currentTenantId = typeof window !== "undefined"
    ? localStorage.getItem("openzorg_tenant_id") || ""
    : "";
  const currentProjectName = typeof window !== "undefined"
    ? localStorage.getItem("openzorg_project_name") || "Tenant"
    : "Tenant";

  useEffect(() => {
    masterFetch<Tenant[]>("/tenants").then(({ data }) => {
      if (data && Array.isArray(data)) {
        setTenants(data.filter((t) => t.status === "active"));
      }
    });
  }, []);

  /* Close on click outside */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function switchTenant(tenant: Tenant) {
    localStorage.setItem("openzorg_tenant_id", tenant.medplum_project_id || tenant.id);
    localStorage.setItem("openzorg_project_name", tenant.name);
    setOpen(false);
    // Reload to apply new tenant context everywhere
    window.location.href = "/dashboard";
  }

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors
                   bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300
                   hover:bg-brand-100 dark:hover:bg-brand-900"
      >
        <IconSwitch className="w-4 h-4 opacity-70" />
        <span className="max-w-[140px] truncate">{currentProjectName}</span>
        <svg className={`w-3 h-3 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-xl bg-raised border border-default shadow-lg z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-default">
            <input
              type="text"
              placeholder="Zoek omgeving..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-body-sm bg-sunken border border-subtle
                         text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              autoFocus
            />
          </div>

          {/* Tenant list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-body-sm text-fg-subtle">Geen omgevingen gevonden</p>
            ) : (
              filtered.map((tenant) => {
                const isCurrent = (tenant.medplum_project_id || tenant.id) === currentTenantId;
                return (
                  <button
                    key={tenant.id}
                    onClick={() => switchTenant(tenant)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                      ${isCurrent ? "bg-brand-50 dark:bg-brand-950" : "hover:bg-sunken"}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0">
                      <span className="text-caption font-bold text-brand-600 dark:text-brand-400">
                        {tenant.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-fg truncate">{tenant.name}</p>
                      <p className="text-caption text-fg-subtle truncate">{tenant.slug}</p>
                    </div>
                    {isCurrent && (
                      <svg className="w-4 h-4 text-brand-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IconSwitch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15 3 21" />
    </svg>
  );
}
