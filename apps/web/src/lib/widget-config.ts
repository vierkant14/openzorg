export interface WidgetConfig {
  id: string;
  label: string;
  /** The tab key this widget links to (for "Bekijk alles") */
  tabKey: string;
  enabled: boolean;
}

/** All available widgets a beheerder can toggle */
export const ALL_WIDGETS: Omit<WidgetConfig, "enabled">[] = [
  { id: "persoonlijke-gegevens", label: "Persoonlijke gegevens", tabKey: "" },
  { id: "zorgplan-samenvatting", label: "Zorgplan samenvatting", tabKey: "zorgplan" },
  { id: "laatste-rapportages", label: "Laatste rapportages", tabKey: "rapportages" },
  { id: "medicatie", label: "Medicatie", tabKey: "medicatie" },
  { id: "allergieen", label: "Allergie\u00ebn", tabKey: "allergieen" },
  { id: "vaccinaties", label: "Vaccinaties", tabKey: "vaccinaties" },
  { id: "contactpersonen", label: "Contactpersonen", tabKey: "contactpersonen" },
  { id: "afspraken", label: "Afspraken", tabKey: "" },
];

const DEFAULT_ENABLED = [
  "persoonlijke-gegevens",
  "zorgplan-samenvatting",
  "laatste-rapportages",
  "medicatie",
  "allergieen",
];

function storageKey(): string {
  const tenantId =
    typeof window !== "undefined"
      ? localStorage.getItem("openzorg_tenant_id") || "default"
      : "default";
  return `openzorg_dashboard_widgets_${tenantId}`;
}

function buildDefault(): WidgetConfig[] {
  return ALL_WIDGETS.map((w) => ({
    ...w,
    enabled: DEFAULT_ENABLED.includes(w.id),
  }));
}

export function loadWidgetConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return buildDefault();

  const raw = localStorage.getItem(storageKey());
  if (!raw) return buildDefault();

  try {
    const saved = JSON.parse(raw) as WidgetConfig[];
    // Merge with ALL_WIDGETS so new widgets added later still appear
    const savedMap = new Map(saved.map((w) => [w.id, w]));
    return ALL_WIDGETS.map((w) => ({
      ...w,
      enabled: savedMap.get(w.id)?.enabled ?? DEFAULT_ENABLED.includes(w.id),
    }));
  } catch {
    return buildDefault();
  }
}

export function saveWidgetConfig(widgets: WidgetConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(widgets));
}
