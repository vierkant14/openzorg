/**
 * SNOMED CT Terminology Lookup.
 *
 * Uses the public Snowstorm SNOMED CT browser API (hosted by SNOMED International).
 * Edition: NL (Dutch) with fallback to International.
 *
 * In production, organizations can host their own Snowstorm instance
 * or use the Nictiz nationale terminologieserver.
 */

const SNOWSTORM_BASE = "https://browser.ihtsdotools.org/snowstorm/snomed-ct";
const EDITION = "MAIN/SNOMEDCT-NL"; // Dutch edition
const FALLBACK_EDITION = "MAIN"; // International edition

export interface SnomedConcept {
  conceptId: string;
  term: string;       // Preferred Dutch term (or English fallback)
  fsn: string;        // Fully specified name
  semanticTag: string; // e.g. "disorder", "substance", "finding"
}

/**
 * Search SNOMED CT for concepts matching a query string.
 * Filters by semantic tag to scope results (e.g. only disorders, substances).
 */
export async function searchSnomed(
  query: string,
  options: {
    semanticTags?: string[];  // e.g. ["disorder", "finding"] for diagnoses, ["substance"] for allergies
    limit?: number;
  } = {},
): Promise<SnomedConcept[]> {
  if (!query || query.length < 2) return [];

  const limit = options.limit ?? 20;
  const semanticFilter = options.semanticTags?.join(",") ?? "";

  // Try Dutch edition first, then international
  for (const edition of [EDITION, FALLBACK_EDITION]) {
    try {
      const params = new URLSearchParams({
        term: query,
        limit: String(limit),
        active: "true",
        language: "nl",
        ...(semanticFilter ? { semanticTag: semanticFilter } : {}),
      });

      const url = `${SNOWSTORM_BASE}/${edition}/concepts?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as {
        items?: Array<{
          conceptId: string;
          pt?: { term: string };
          fsn?: { term: string };
        }>;
      };

      if (!data.items || data.items.length === 0) continue;

      return data.items.map((item) => {
        const fsn = item.fsn?.term ?? "";
        const tagMatch = fsn.match(/\(([^)]+)\)$/);
        return {
          conceptId: item.conceptId,
          term: item.pt?.term ?? fsn.replace(/\s*\([^)]+\)$/, ""),
          fsn,
          semanticTag: tagMatch?.[1] ?? "",
        };
      });
    } catch {
      // Network error or timeout — try next edition
      continue;
    }
  }

  return [];
}

/**
 * Get a single SNOMED concept by ID.
 */
export async function getSnomedConcept(conceptId: string): Promise<SnomedConcept | null> {
  for (const edition of [EDITION, FALLBACK_EDITION]) {
    try {
      const url = `${SNOWSTORM_BASE}/${edition}/concepts/${conceptId}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const item = (await res.json()) as {
        conceptId: string;
        pt?: { term: string };
        fsn?: { term: string };
      };

      const fsn = item.fsn?.term ?? "";
      const tagMatch = fsn.match(/\(([^)]+)\)$/);

      return {
        conceptId: item.conceptId,
        term: item.pt?.term ?? fsn.replace(/\s*\([^)]+\)$/, ""),
        fsn,
        semanticTag: tagMatch?.[1] ?? "",
      };
    } catch {
      continue;
    }
  }

  return null;
}
