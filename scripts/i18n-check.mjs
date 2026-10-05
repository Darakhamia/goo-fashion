// Checks the goo-studio dictionaries (docs/ADMIN_ROADMAP.md, GS4-8).
//
//   node scripts/i18n-check.mjs            report; fails only on translated files
//   node scripts/i18n-check.mjs --list     also print every raw string found
//   node scripts/i18n-check.mjs --strict   also fail when ru.ts misses a key
//
// 1. ru.ts against en.ts: keys missing from the Russian dictionary (English is
//    shown in their place) and keys ru.ts has that en.ts does not.
// 2. Interface text written straight into JSX instead of going through t():
//    JSX text, and string literals in placeholder / title / aria-label / alt /
//    label attributes. Files listed in TRANSLATED must have none — CI runs this
//    script, so a translated screen cannot slide back. Every other admin file
//    is reported with its count until GS4-12 moves it onto the dictionary.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const I18N = path.join(ROOT, "src/app/goo-studio/_i18n");
const args = new Set(process.argv.slice(2));

/** Admin files whose interface text is fully in the dictionary. */
const TRANSLATED = [
  "src/app/goo-studio/_ui/AdminShell.tsx",
  "src/app/goo-studio/page.tsx",
  "src/app/goo-studio/prompts/page.tsx",
  "src/components/admin/ConfirmDialog.tsx",
  "src/components/admin/Toast.tsx",
  "src/components/admin/HelpToggle.tsx",
  "src/components/admin/ImageCropEditor.tsx",
  "src/components/admin/AttentionList.tsx",
  "src/components/admin/DataTable.tsx",
  "src/components/admin/FilterBar.tsx",
  "src/components/admin/KpiStrip.tsx",
  "src/components/admin/PageHeader.tsx",
  "src/components/admin/SidePanel.tsx",
];

/** Attributes that carry text a person reads or hears. */
const TEXT_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);

/** Keys of the object literal exported from a dictionary file. */
function dictKeys(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const keys = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      let init = node.initializer;
      while (ts.isSatisfiesExpression?.(init) || ts.isAsExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) {
        for (const p of init.properties) {
          if (ts.isPropertyAssignment(p)) keys.add(p.name.text ?? p.name.getText(src));
        }
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return keys;
}

/** Raw interface strings in one .tsx file. */
function rawStrings(file) {
  const text = fs.readFileSync(file, "utf8");
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const hasWords = (s) => /\p{L}{2,}/u.test(s);
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const s = node.text.replace(/\s+/g, " ").trim();
      if (hasWords(s)) found.push([node, s]);
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(src);
      const init = node.initializer;
      if (TEXT_ATTRS.has(name) && init) {
        if (ts.isStringLiteral(init) && hasWords(init.text)) found.push([node, `${name}="${init.text}"`]);
        if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression) && hasWords(init.expression.text))
          found.push([node, `${name}="${init.expression.text}"`]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return found.map(([node, s]) => ({ line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1, s }));
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

let failed = false;

// 1. Dictionary coverage.
const en = dictKeys(path.join(I18N, "en.ts"));
const ru = dictKeys(path.join(I18N, "ru.ts"));
const missing = [...en].filter((k) => !ru.has(k));
const extra = [...ru].filter((k) => !en.has(k));
console.log(`Dictionary: ${en.size} keys in en.ts, ${en.size - missing.length} translated in ru.ts.`);
if (missing.length) {
  console.log(`  ru.ts misses ${missing.length} key(s); English is shown for them${args.has("--strict") ? "" : " (not an error until the Russian pass)"}:`);
  for (const k of missing.slice(0, 50)) console.log(`    ${k}`);
  if (args.has("--strict")) failed = true;
}
if (extra.length) {
  console.log(`  ru.ts has ${extra.length} key(s) that en.ts does not:`);
  for (const k of extra) console.log(`    ${k}`);
  failed = true;
}

// 2. Raw interface text.
const files = [...walk(path.join(ROOT, "src/app/goo-studio")), ...walk(path.join(ROOT, "src/components/admin"))]
  .map((f) => path.relative(ROOT, f))
  .filter((f) => !f.includes("/_i18n/"))
  .sort();
console.log("\nInterface text outside the dictionary:");
for (const f of files) {
  const found = rawStrings(path.join(ROOT, f));
  const done = TRANSLATED.includes(f);
  if (done && found.length) failed = true;
  if (!found.length && !done) continue;
  console.log(`  ${done ? (found.length ? "FAIL" : "ok  ") : "todo"} ${f}: ${found.length}`);
  if (found.length && (done || args.has("--list"))) for (const { line, s } of found) console.log(`         ${line}: ${s.slice(0, 100)}`);
}
for (const f of TRANSLATED) if (!files.includes(f)) { console.log(`  FAIL ${f}: listed in TRANSLATED but not found`); failed = true; }

process.exit(failed ? 1 : 0);
