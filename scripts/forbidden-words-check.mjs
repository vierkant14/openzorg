#!/usr/bin/env node

/**
 * Forbidden-words check for OpenZorg CI pipeline.
 * Ensures no terms unique to Nedap ONS API or documentation appear in the codebase.
 * See bijlage 17.1 of the requirements document.
 *
 * Usage: node scripts/forbidden-words-check.mjs
 * Exit code 0: no forbidden words found
 * Exit code 1: forbidden words found (build should fail)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_WORDS_FILE = join(__dirname, "forbidden-words.txt");

const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".yaml",
  ".yml",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".turbo",
  "coverage",
]);

const IGNORE_FILES = new Set([
  "forbidden-words.txt",
  "forbidden-words-check.mjs",
  "CLAUDE.md",
  "datamodel-overzicht.md",
  "koppelstrategie.md",
]);

function loadForbiddenWords(filePath) {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (SCAN_EXTENSIONS.has(extname(entry)) && !IGNORE_FILES.has(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFile(filePath, patterns) {
  const content = readFileSync(filePath, "utf-8");
  const violations = [];

  for (const [word, regex] of patterns) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        violations.push({
          file: filePath,
          line: i + 1,
          word,
          context: lines[i].trim(),
        });
      }
    }
  }

  return violations;
}

// Main
const rootDir = join(__dirname, "..");
const forbiddenWords = loadForbiddenWords(FORBIDDEN_WORDS_FILE);
const patterns = forbiddenWords.map((word) => [
  word,
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
]);

const files = walkDir(rootDir);
let allViolations = [];

for (const file of files) {
  const violations = checkFile(file, patterns);
  allViolations.push(...violations);
}

if (allViolations.length > 0) {
  console.error("\n❌ Forbidden words found in codebase:\n");
  for (const v of allViolations) {
    const relPath = relative(rootDir, v.file);
    console.error(`  ${relPath}:${v.line} — "${v.word}"`);
    console.error(`    ${v.context}\n`);
  }
  console.error(
    `\n${allViolations.length} violation(s) found. These terms are unique to commercial ` +
      `ECD systems and must not appear in the OpenZorg codebase.\n` +
      `Use Zib/FHIR equivalents instead. See docs/architecture/ADR-001-medplum.md.\n`,
  );
  process.exit(1);
} else {
  console.error(`✅ No forbidden words found (checked ${files.length} files, ${forbiddenWords.length} words)`);
  process.exit(0);
}
