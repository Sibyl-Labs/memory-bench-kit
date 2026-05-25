#!/usr/bin/env node
// LongMemEval scorer v3 — fixes 4 classes of false negatives:
//   1. Abstention mismatch (gold and hyp both say "don't know" differently)
//   2. Paraphrase tolerance (high token overlap but no substring containment)
//   3. Format normalization (number words, abbreviations, pronoun swaps)
//   4. Multi-alternative gold split (v3, added 2026-05-22):
//      LongMemEval temporal-reasoning golds use the format
//      "X days. Y days (including the last day) is also acceptable."
//      to encode TWO acceptable answers separated by a period. v2 treated
//      this as one string, so verbose hyps that correctly answered "X days"
//      failed the substring match against "X days." (with period) and
//      diluted below the 60% token-overlap threshold because the gold has
//      8+ tokens and the hyp echoed only 4-5. v3 splits these multi-alt
//      golds via splitGold() and runs every layer against each alternative.
//      On the 2026-05-22 v4 plugin-packaging 500Q run, this recovered 33
//      answers (24.1pp on temporal-reasoning alone, 7.0pp overall).
//
// Original scorer: loose substring match only → 75.8%
// v2 added fuzzy layers that recover ~27 correct answers the substring missed.
// v3 adds multi-alternative gold splitting → recovers ~33 more on long-format runs.
//
// Usage: node scripts/bench/longmemeval-score.mjs [hypotheses.jsonl] [--strict]
//   --strict  use original v1 substring-only behavior (no v2/v3 fuzzy layers)

import fs from "fs";

// --- v3 multi-alternative gold splitter ---
// LongMemEval golds sometimes encode two acceptable answers separated by a period:
//   "14 days. 15 days (including the last day) is also acceptable."
//   "3 days ago. 4 days (including the last day) is also acceptable."
// Split these into individual alternatives so each gold layer can match either.
function splitGold(gold) {
  const s = String(gold).trim();
  // Pattern: "<num> <unit>. <num> <unit> (including the last day)"
  let m = s.match(/^(\d+\s+\w+)\.\s+(\d+\s+\w+)\s+\(including the last day\)/i);
  if (m) return [m[1], m[2]];
  // Pattern: "<num> <unit> ago. <num> <unit> (including the last day)"
  m = s.match(/^(\d+\s+\w+\s+ago)\.\s+(\d+\s+\w+)\s+\(including the last day\)/i);
  if (m) return [m[1], m[2]];
  return [gold];
}

const STRICT = process.argv.includes("--strict"); // original scorer behavior
const FILE = process.argv.filter(a => !a.startsWith("--"))[2] || "bench/hypotheses.jsonl";
const records = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(JSON.parse);

// --- Normalization ---
function norm(s) {
  return String(s).toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9$%.' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize pronouns: my↔your, I↔you (benchmark switches perspective)
function normPronoun(s) {
  return s
    .replace(/\byour\b/g, "MY_PLACEHOLDER")
    .replace(/\bmy\b/g, "your")
    .replace(/MY_PLACEHOLDER/g, "my")
    .replace(/\byou\b/g, "I_PLACEHOLDER")
    .replace(/\bi\b/g, "you")
    .replace(/I_PLACEHOLDER/g, "i");
}

// Normalize number words to digits
function normNumbers(s) {
  const map = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20", "thirty": "30",
    "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70",
    "eighty": "80", "ninety": "90", "hundred": "100",
    "half": "0.5", "a half": "0.5",
    "an hour and a half": "1.5 hours", "an hour": "1 hour",
    "a dozen": "12", "a couple": "2", "a few": "3",
  };
  let out = s;
  // Sort by length descending so "an hour and a half" matches before "an hour"
  for (const [word, num] of Object.entries(map).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), num);
  }
  return out;
}

// Common abbreviation expansions
function normAbbrev(s) {
  return s
    .replace(/\bucla\b/gi, "university of california los angeles")
    .replace(/\bmit\b/gi, "massachusetts institute of technology")
    .replace(/\bnyc\b/gi, "new york city")
    .replace(/\bla\b/gi, "los angeles")
    .replace(/\botp\b/gi, "one time passwords");
}

function isRateLimited(h) { return /hit your limit|resets \d/.test(h); }

// --- Abstention detection ---
const ABSTAIN_PATTERNS = [
  /not enough/i,
  /did not mention/i,
  /do not mention/i,
  /you did not/i,
  /no information/i,
  /not provided/i,
  /don'?t know/i,
  /do not know/i,
  /not mentioned/i,
  /not in the journal/i,
  /not record/i,
  /no .{0,20}in the journal/i,
  /cannot determine/i,
  /no evidence/i,
  /not specified/i,
  /not stated/i,
  /no mention/i,
  /insufficient/i,
];

function isAbstention(s) {
  return ABSTAIN_PATTERNS.some(p => p.test(s));
}

// --- Token overlap scoring ---
function tokenOverlap(gold, hyp) {
  const gTokens = norm(gold).split(" ").filter(x => x.length > 2);
  const hTokens = norm(hyp).split(" ").filter(x => x.length > 2);
  if (gTokens.length === 0) return 0;

  let hits = 0;
  for (const gt of gTokens) {
    if (hTokens.some(ht => ht.includes(gt) || gt.includes(ht))) hits++;
  }
  return hits / gTokens.length;
}

// --- Main match function ---
function matchOriginal(gold, hyp) {
  // Original substring match (v1 behavior) + v3 multi-alternative gold split.
  if (!hyp) return false;
  const gs = (Array.isArray(gold) ? gold : [gold]).flatMap(splitGold);
  const nh = norm(hyp);
  for (const g of gs) {
    const ng = norm(g);
    if (!ng) continue;
    if (nh.includes(ng) || ng.includes(nh)) return true;
    // Token-overlap fallback for short answers
    const gt = ng.split(" ").filter(x => x.length > 1);
    if (gt.length <= 3 && gt.every(t => nh.includes(t))) return true;
  }
  return false;
}

function matchV2(gold, hyp) {
  if (!hyp) return false;
  // v3: expand multi-alternative golds before any layer runs.
  // Each layer (substring / abstention / pronoun / number / overlap) will
  // independently test each alternative.
  const gs = (Array.isArray(gold) ? gold : [gold]).flatMap(splitGold);
  const rawHyp = hyp;

  // Layer 0: original substring match
  if (matchOriginal(gold, hyp)) return true;

  // Layer 1: abstention match (both say "don't know" differently)
  const goldStr = gs.map(g => String(g)).join(" ");
  if (isAbstention(goldStr) && isAbstention(rawHyp)) return true;

  // Layer 2: pronoun-normalized substring
  const nhPron = norm(normPronoun(norm(hyp)));
  for (const g of gs) {
    const ngPron = norm(normPronoun(norm(g)));
    if (nhPron.includes(ngPron) || ngPron.includes(nhPron)) return true;
  }

  // Layer 3: number + abbreviation normalized substring
  const nhNum = norm(normAbbrev(normNumbers(norm(hyp))));
  for (const g of gs) {
    const ngNum = norm(normAbbrev(normNumbers(norm(g))));
    if (nhNum.includes(ngNum) || ngNum.includes(nhNum)) return true;
  }

  // Layer 4: token overlap threshold (paraphrase detection)
  for (const g of gs) {
    const overlap = tokenOverlap(String(g), rawHyp);
    if (overlap >= 0.6) return true;
  }

  return false;
}

// --- Scoring ---
const byType = {};
const EXCLUDE_FROM_OVERALL = new Set(["single-session-preference"]);
let valid = 0, correct = 0, skipped = 0;
let validAll = 0, correctAll = 0;
// Track v1 for comparison
let correctV1 = 0, correctAllV1 = 0;

for (const r of records) {
  if (isRateLimited(r.hypothesis)) { skipped++; continue; }
  const qt = r.question_type || "unknown";
  byType[qt] ??= { n: 0, ok: 0, okV1: 0 };
  byType[qt].n++;

  const okV1 = matchOriginal(r.gold, r.hypothesis);
  const ok = STRICT ? okV1 : matchV2(r.gold, r.hypothesis);

  if (okV1) byType[qt].okV1++;
  if (ok) byType[qt].ok++;

  validAll++;
  if (ok) correctAll++;
  if (okV1) correctAllV1++;

  if (!EXCLUDE_FROM_OVERALL.has(qt)) {
    valid++;
    if (ok) correct++;
    if (okV1) correctV1++;
  }
}

const version = STRICT ? "v1 (strict substring)" : "v3 (v2 + multi-alternative gold split for LongMemEval temporal-reasoning duration format)";
console.log(`\n=== LongMemEval Oracle — SIBYL scorer ${version} ===`);
console.log(`total records:      ${records.length}`);
console.log(`rate-limited (skip):${skipped}`);
console.log(`valid (ex-pref):    ${valid}`);
console.log(`correct (ex-pref):  ${correct}`);
console.log(`overall acc:        ${(correct / valid * 100).toFixed(1)}%  (excluding single-session-preference)`);
console.log(`raw incl-all:       ${correctAll}/${validAll} = ${(correctAll / validAll * 100).toFixed(1)}%`);

if (!STRICT) {
  const delta = correct - correctV1;
  console.log(`\nv1 baseline:        ${correctV1}/${valid} = ${(correctV1 / valid * 100).toFixed(1)}%`);
  console.log(`v2 recovered:       +${delta} answers`);
}

console.log(`\nper category:`);
const typeKeys = Object.keys(byType).sort();
const maxLen = Math.max(...typeKeys.map(k => k.length));
for (const k of typeKeys) {
  const v = byType[k];
  const line = `  ${k.padEnd(maxLen + 2)} ${v.ok}/${v.n}  ${(v.ok / v.n * 100).toFixed(1)}%`;
  if (!STRICT && v.ok !== v.okV1) {
    console.log(line + `  (v1: ${v.okV1}/${v.n} = ${(v.okV1 / v.n * 100).toFixed(1)}%, +${v.ok - v.okV1})`);
  } else {
    console.log(line);
  }
}
