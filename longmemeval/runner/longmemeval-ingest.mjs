#!/usr/bin/env node
// LongMemEval -> SIBYL hierarchical memory adapter.
// For each question, builds a scratch memory dir at bench/runs/<question_id>/memory/
// that mirrors SIBYL's shape: INDEX.json, state/, entities/people/user.json,
// logs/journal/current.jsonl. The journal is the ground-truth COLD log — every
// turn across every session is appended with its real session timestamp.
//
// Usage: node scripts/bench/longmemeval-ingest.mjs <data.json> [limit]

import fs from "fs";
import path from "path";

const DATA = process.argv[2] || "bench/LongMemEval/data/longmemeval_oracle.json";
const LIMIT = parseInt(process.argv[3] || "0", 10);
const ROOT = "bench/runs";

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const items = LIMIT > 0 ? data.slice(0, LIMIT) : data;

fs.mkdirSync(ROOT, { recursive: true });

function mkdirs(base) {
  for (const d of ["state", "entities/people", "logs/journal"]) {
    fs.mkdirSync(path.join(base, d), { recursive: true });
  }
}

let written = 0;
for (const q of items) {
  const dir = path.join(ROOT, q.question_id);
  const mem = path.join(dir, "memory");
  mkdirs(mem);

  // Flatten all sessions into a single chronological journal.
  const lines = [];
  const sessions = q.haystack_sessions || [];
  const dates = q.haystack_dates || [];
  const sids = q.haystack_session_ids || [];
  for (let i = 0; i < sessions.length; i++) {
    const ts = dates[i] || "unknown";
    const sid = sids[i] || `s${i}`;
    for (const turn of sessions[i]) {
      lines.push(JSON.stringify({
        ts,
        session: sid,
        role: turn.role,
        content: turn.content,
      }));
    }
  }
  fs.writeFileSync(path.join(mem, "logs/journal/current.jsonl"), lines.join("\n") + "\n");

  // Minimal INDEX + state
  fs.writeFileSync(path.join(mem, "INDEX.json"), JSON.stringify({
    version: 1,
    schema: "hierarchical-v1",
    hot: ["state/session.json"],
    entities: { people: { user: "entities/people/user.json" } },
    logs: ["logs/journal/current.jsonl"],
    note: "LongMemEval scratch memory. All chat history lives in the journal, chronologically, with real session timestamps.",
  }, null, 2));

  fs.writeFileSync(path.join(mem, "state/session.json"), JSON.stringify({
    last_session: q.question_date,
    summary: "Benchmark run. All prior interaction with the user is in logs/journal/current.jsonl sorted by ts.",
    forward: ["answer the benchmark question using only the journal"],
    entities_touched: ["people/user"],
  }, null, 2));

  fs.writeFileSync(path.join(mem, "entities/people/user.json"), JSON.stringify({
    name: "user",
    note: "Single user across all sessions. All facts about them must be derived from the journal.",
  }, null, 2));

  // Write the question + metadata (not read by the agent; used by the runner)
  fs.writeFileSync(path.join(dir, "question.json"), JSON.stringify({
    question_id: q.question_id,
    question_type: q.question_type,
    question: q.question,
    answer: q.answer,
    question_date: q.question_date,
  }, null, 2));

  written++;
}

console.log(`wrote ${written} scratch memory dirs under ${ROOT}/`);
