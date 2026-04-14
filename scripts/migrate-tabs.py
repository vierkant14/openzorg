#!/usr/bin/env python3
"""
One-shot tab-migratiescript voor Plan 2A Task 4.

Leest apps/web/src/app/ecd/[id]/page.tsx, extraheert elke tab-functie tussen
vooraf bekende start-regels, en schrijft nieuwe route-files.

De monolith zelf wordt door dit script NIET aangepast — dat gebeurt in een
aparte finale stap waarin de hele file wordt vervangen door een 5-regel
redirect.

Aanroep:
    python scripts/migrate-tabs.py --list              # toon geplande extracties
    python scripts/migrate-tabs.py --only contactpersonen
    python scripts/migrate-tabs.py --all
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MONOLITH = REPO / "apps/web/src/app/ecd/[id]/page.tsx"
ROUTES_DIR = REPO / "apps/web/src/app/ecd/[id]"

# Tab-configuratie: (slug, start_line, function_name, page_component_name, needs_client_fetch)
TABS = [
    # (slug, start_line, fn_name, page_name, needs_client_prop)
    ("contactpersonen", 1165, "ContactpersonenTab", "ContactpersonenPage", False),
    ("documenten", 1457, "DocumentenTab", "DocumentenPage", False),
    ("extra-velden", 1563, "ExtraVeldenTab", "ExtraVeldenPage", True),
    ("risicoscreening", 1740, "RisicoscreeningsTab", "RisicoscreeningPage", False),
    ("toediening", 1858, "ToedieningTab", "ToedieningPage", False),
    ("vragenlijsten", 2069, "VragenlijstenTab", "VragenlijstenPage", False),
    ("mdo", 2269, "MdoTab", "MdoPage", False),
    ("vbm", 2440, "VbmTab", "VbmPage", False),
    ("wilsverklaringen", 2639, "WilsverklaringenTab", "WilsverklaringenPage", False),
    ("medicatie-overzicht", 2820, "MedicatieOverzichtTab", "MedicatieOverzichtPage", False),
    ("dashboard", 749, "DashboardTab", "DashboardPage", True),
]

# Helper functies die mogelijk gedupliceerd worden — geïdentificeerd op inhoud
SHARED_HELPERS = {
    "formatDate": r"function formatDate\(iso\?: string\): string \{[\s\S]*?\n\}",
    "formatDateTime": r"function formatDateTime\(iso\?: string\): string \{[\s\S]*?\n\}",
    "Spinner": r"function Spinner\(\)[\s\S]*?\n\}",
    "ErrorMsg": r"function ErrorMsg\(\{[\s\S]*?\n\}",
}

# Type-definities die gedupliceerd mogen worden per route
SHARED_TYPES = {
    "FhirBundle": r"interface FhirBundle<T> \{[\s\S]*?\n\}",
    "FhirObservation": r"interface FhirObservation \{[\s\S]*?\n\}",
    "FhirRelatedPerson": r"interface FhirRelatedPerson \{[\s\S]*?\n\}",
    "FhirCarePlan": r"interface FhirCarePlan \{[\s\S]*?\n\}",
    "FhirDocumentReference": r"interface FhirDocumentReference \{[\s\S]*?\n\}",
    "FhirMedicationRequest": r"interface FhirMedicationRequest \{[\s\S]*?\n\}",
    "ClientResource": r"interface ClientResource \{[\s\S]*?\n\}",
    "CustomFieldDef": r"interface CustomFieldDef \{[\s\S]*?\n\}",
}

# Constanten zoals RELATIE_TYPES, LEEFGEBIEDEN etc die tab-specifiek zijn
SHARED_CONSTANTS = {
    "RELATIE_TYPES": r"const RELATIE_TYPES[\s\S]*?\n\];",
}


def read_monolith() -> list[str]:
    return MONOLITH.read_text(encoding="utf-8").splitlines(keepends=True)


def find_function_end(lines: list[str], start_idx: int) -> int:
    """Given the 0-based index of a line that matches '^function Name(',
    find the index of its closing brace by brace-counting.

    Skip braces that appear inside the parameter list (destructuring,
    type annotations). Start counting only from the body-opening brace,
    which is the first `{` after the outermost `)`.
    """
    # Collect full source text from start_idx onwards, tracking line indices
    flat = "".join(lines[start_idx:])
    # Find the body-opening brace: first `{` after the matching `)` that
    # closes the function parameter list.
    paren_depth = 0
    paren_closed_at: int | None = None
    for i, ch in enumerate(flat):
        if ch == "(":
            paren_depth += 1
        elif ch == ")":
            paren_depth -= 1
            if paren_depth == 0:
                paren_closed_at = i
                break
    if paren_closed_at is None:
        return len(lines) - 1

    # From paren_closed_at, find the first '{'
    body_open = flat.find("{", paren_closed_at)
    if body_open < 0:
        return len(lines) - 1

    # Now count braces from body_open
    depth = 0
    body_close: int | None = None
    for i in range(body_open, len(flat)):
        ch = flat[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                body_close = i
                break
    if body_close is None:
        return len(lines) - 1

    # Convert body_close char-offset back to 0-based line index within `lines`
    chars_consumed = 0
    for offset_i in range(len(lines) - start_idx):
        line_len = len(lines[start_idx + offset_i])
        if chars_consumed + line_len > body_close:
            return start_idx + offset_i
        chars_consumed += line_len
    return len(lines) - 1


def extract_range(lines: list[str], start_line_1based: int) -> tuple[int, int, str]:
    """Return (start_idx_0based, end_idx_0based, content)."""
    # Zoek de werkelijke 'function X' op of na de start_line; plan-lines
    # kunnen een paar regels afwijken.
    start_idx = start_line_1based - 1
    # Zoek naar functie-keyword binnen een window van 20 regels
    for i in range(max(0, start_idx - 5), min(len(lines), start_idx + 20)):
        if re.match(r"^function \w+", lines[i]):
            start_idx = i
            break
    end_idx = find_function_end(lines, start_idx)
    content = "".join(lines[start_idx : end_idx + 1])
    return start_idx, end_idx, content


def build_declaration_registry(monolith_text: str, lines: list[str]) -> dict[str, str]:
    """Scan the monolith and build a map from top-level declaration name
    to its full source code. Handles: interface, type, const, function.

    Brace matching uses the same logic as find_function_end.
    """
    registry: dict[str, str] = {}

    # interface/type declarations — simple regex + brace count
    for i, line in enumerate(lines):
        # interface Name {
        m = re.match(r"^interface (\w+)", line)
        if m:
            name = m.group(1)
            end = find_function_end(lines, i)
            registry[name] = "".join(lines[i : end + 1])
            continue

        # type Name = ...; (single line, no brace)
        m = re.match(r"^type (\w+)\s*=", line)
        if m:
            name = m.group(1)
            # If the line ends with ; on same line, one-liner; else find closing
            if line.rstrip().endswith(";"):
                registry[name] = line
            else:
                # Multi-line type alias — extend until ; or closing brace balance
                depth = 0
                end_i = i
                for j in range(i, len(lines)):
                    for ch in lines[j]:
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                    if depth == 0 and lines[j].rstrip().endswith(";"):
                        end_i = j
                        break
                registry[name] = "".join(lines[i : end_i + 1])
            continue

        # function Name(
        m = re.match(r"^function (\w+)", line)
        if m:
            name = m.group(1)
            end = find_function_end(lines, i)
            registry[name] = "".join(lines[i : end + 1])
            continue

        # const Name = ...
        m = re.match(r"^const (\w+)", line)
        if m:
            name = m.group(1)
            if line.rstrip().endswith(";"):
                registry[name] = line
            else:
                # Multi-line const: scan until balanced braces + ending semicolon
                depth = 0
                brackets = 0
                end_i = i
                for j in range(i, len(lines)):
                    for ch in lines[j]:
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                        elif ch == "[":
                            brackets += 1
                        elif ch == "]":
                            brackets -= 1
                    if depth == 0 and brackets == 0 and lines[j].rstrip().endswith((";", ",", "}")):
                        end_i = j
                        if lines[j].rstrip().endswith(";"):
                            break
                registry[name] = "".join(lines[i : end_i + 1])
            continue

    return registry


def find_referenced_helpers(body: str, registry: dict[str, str], exclude: set[str]) -> str:
    """Given a tab body and the full declaration registry, find all names
    referenced in the body (excluding `exclude`) and return their source
    concatenated. Does recursive transitive closure: if a helper references
    another helper, include that too.
    """
    included: set[str] = set()
    pending: set[str] = set()

    # Initial pass: find names from registry referenced in body
    for name in registry:
        if name in exclude:
            continue
        if re.search(rf"\b{re.escape(name)}\b", body):
            pending.add(name)

    # Transitive closure
    while pending:
        name = pending.pop()
        if name in included or name in exclude:
            continue
        included.add(name)
        source = registry[name]
        for other in registry:
            if other in included or other in exclude or other == name:
                continue
            if re.search(rf"\b{re.escape(other)}\b", source):
                pending.add(other)

    # Sort by source order in monolith for deterministic output
    ordered = sorted(included, key=lambda n: registry[n])
    return "\n\n".join(registry[n] for n in ordered)


def rename_to_page(body: str, fn_name: str, page_name: str, needs_client_prop: bool) -> str:
    """Rewrite the extracted function to be an exported default page component.

    Replace signature `function TabName({ clientId, ... }: ...)` with a wrapper
    that calls useParams() and then renders the tab function.
    """
    # Match signature line like `function ContactpersonenTab({ clientId }: { clientId: string }) {`
    # Of `function ExtraVeldenTab({ clientId, client }: { clientId: string; client: ClientResource }) {`
    sig_re = re.compile(
        r"function " + re.escape(fn_name) + r"\(\{([^}]*)\}:\s*\{[^}]*\}\)\s*\{"
    )
    m = sig_re.search(body)
    if not m:
        raise SystemExit(
            f"Kon signature van {fn_name} niet vinden. Eerste regel: {body.splitlines()[0]}"
        )

    props = [p.strip() for p in m.group(1).split(",") if p.strip()]
    # Behoud originele function body; we renamen de function naar ${fn_name}Inner
    # en maken een wrapper page-component die useParams gebruikt + eventueel client fetcht.

    inner_name = fn_name + "Inner"
    renamed_body = sig_re.sub(
        f"function {inner_name}({{ {', '.join(props)} }}: {{ {get_props_type(props, needs_client_prop)} }}) {{",
        body,
        count=1,
    )

    if needs_client_prop:
        wrapper = f"""
export default function {page_name}() {{
  const params = useParams<{{ id: string }}>();
  const clientId = params?.id ?? "";
  const [client, setClient] = useState<ClientResource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {{
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    ecdFetch<ClientResource>(`/api/clients/${{clientId}}`).then(({{ data }}) => {{
      if (!cancelled) setClient(data ?? null);
      if (!cancelled) setLoading(false);
    }});
    return () => {{ cancelled = true; }};
  }}, [clientId]);

  if (loading) return <Spinner />;
  if (!client) return <ErrorMsg msg="Cliënt niet gevonden" />;
  return <{inner_name} clientId={{clientId}} client={{client}} />;
}}
"""
    else:
        wrapper = f"""
export default function {page_name}() {{
  const params = useParams<{{ id: string }}>();
  const clientId = params?.id ?? "";
  return <{inner_name} clientId={{clientId}} />;
}}
"""
    return renamed_body + "\n" + wrapper


def get_props_type(props: list[str], needs_client: bool) -> str:
    parts = []
    for p in props:
        if p == "clientId":
            parts.append("clientId: string")
        elif p == "client":
            parts.append("client: ClientResource")
        else:
            parts.append(f"{p}: unknown")
    return "; ".join(parts)


def build_imports(body: str) -> str:
    """Build the import block based on what the body references."""
    imports = []
    react_hooks = []
    for hook in ["useState", "useEffect", "useCallback", "useRef", "useMemo"]:
        if re.search(rf"\b{hook}\b", body):
            react_hooks.append(hook)
    if react_hooks:
        imports.append(f"import {{ {', '.join(react_hooks)} }} from \"react\";")
    imports.append('import { useParams } from "next/navigation";')
    imports.append('import Link from "next/link";')
    imports.append('import { ecdFetch } from "../../../../lib/api";')
    return "\n".join(imports)


def build_route_file(
    body: str,
    helpers: str,
    fn_name: str,
    page_name: str,
    needs_client_prop: bool,
) -> str:
    """Build the full content of the new route page.tsx."""
    imports = build_imports(body)
    body_with_wrapper = rename_to_page(body, fn_name, page_name, needs_client_prop)

    return f'''"use client";

{imports}

/* -------------------------------------------------------------------------- */
/*  Gededupliceerd van monolith tijdens Plan 2A Task 4 migratie               */
/* -------------------------------------------------------------------------- */

{helpers}

/* -------------------------------------------------------------------------- */
/*  Tab content                                                               */
/* -------------------------------------------------------------------------- */

{body_with_wrapper}
'''


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--only", type=str, default=None)
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    lines = read_monolith()
    monolith_text = "".join(lines)

    # Build a registry of all top-level declarations in the monolith
    registry = build_declaration_registry(monolith_text, lines)

    # Build exclude set: names of tab functions themselves should not be
    # included as dependencies (they stay in the monolith, get deleted later)
    exclude = {fn for _, _, fn, _, _ in TABS}
    # Also exclude ClientDetailPage, PageShell, SignaleringenBanner, ClientEditForm
    exclude.update({"ClientDetailPage", "PageShell", "SignaleringenBanner", "ClientEditForm"})

    if args.list:
        for slug, start, fn, _, _ in TABS:
            # Verifieer dat de functie echt op of rond start bestaat
            present = any(
                lines[i].startswith(f"function {fn}")
                for i in range(max(0, start - 5), min(len(lines), start + 20))
            )
            status = "OK" if present else "MISSING"
            print(f"  [{status}] {slug:22} {fn:26} start~{start}")
        return 0

    selected = TABS
    if args.only:
        selected = [t for t in TABS if t[0] == args.only]
        if not selected:
            print(f"Onbekende slug: {args.only}", file=sys.stderr)
            return 1

    if not args.all and not args.only:
        print("Gebruik --list / --only <slug> / --all", file=sys.stderr)
        return 1

    for slug, start, fn, page, needs_client in selected:
        try:
            _, _, body = extract_range(lines, start)
        except SystemExit as e:
            print(f"FAIL {slug}: {e}", file=sys.stderr)
            continue
        helpers = find_referenced_helpers(body, registry, exclude)
        try:
            route_content = build_route_file(body, helpers, fn, page, needs_client)
        except SystemExit as e:
            print(f"FAIL {slug}: {e}", file=sys.stderr)
            continue

        target_dir = ROUTES_DIR / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "page.tsx"
        target.write_text(route_content, encoding="utf-8")
        print(f"  [WROTE] {slug:22} {len(route_content.splitlines())} regels -> {target}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
