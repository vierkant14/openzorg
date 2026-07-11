/**
 * Mini-CSV-parser voor de cliëntimport (W3-1). Geen dependency:
 * ondersteunt ';' of ',' als scheidingsteken (auto-detectie op de
 * header-regel), dubbele-quote-velden met "" als escape, en CRLF/LF.
 */

export interface CsvResultaat {
  header: string[];
  rijen: string[][];
  scheidingsteken: ";" | ",";
}

function detecteerScheidingsteken(headerRegel: string): ";" | "," {
  const puntkomma = (headerRegel.match(/;/g) ?? []).length;
  const komma = (headerRegel.match(/,/g) ?? []).length;
  return komma > puntkomma ? "," : ";";
}

function parseRegel(regel: string, scheidingsteken: string): string[] {
  const velden: string[] = [];
  let huidig = "";
  let inQuotes = false;

  for (let i = 0; i < regel.length; i++) {
    const teken = regel[i];

    if (inQuotes) {
      if (teken === '"') {
        if (regel[i + 1] === '"') {
          huidig += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        huidig += teken;
      }
    } else if (teken === '"') {
      inQuotes = true;
    } else if (teken === scheidingsteken) {
      velden.push(huidig.trim());
      huidig = "";
    } else {
      huidig += teken;
    }
  }
  velden.push(huidig.trim());
  return velden;
}

export function parseCsv(tekst: string): CsvResultaat {
  const regels = tekst
    .replace(/^﻿/, "") // BOM (Excel-exports)
    .split(/\r?\n/)
    .filter((regel) => regel.trim().length > 0);

  if (regels.length === 0) {
    return { header: [], rijen: [], scheidingsteken: ";" };
  }

  const scheidingsteken = detecteerScheidingsteken(regels[0]!);
  const header = parseRegel(regels[0]!, scheidingsteken).map((kolom) => kolom.toLowerCase());
  const rijen = regels.slice(1).map((regel) => parseRegel(regel, scheidingsteken));

  return { header, rijen, scheidingsteken };
}
