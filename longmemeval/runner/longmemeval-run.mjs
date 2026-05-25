#!/usr/bin/env node
// Runs the answer phase for each ingested question by spawning a fresh
// `claude -p` subprocess inside the scratch dir. Writes hypotheses.jsonl
// in the format the LongMemEval evaluator expects.
//
// Usage: node scripts/bench/longmemeval-run.mjs [limit] [concurrency]

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = "bench/runs";
const OUT = "bench/hypotheses.jsonl";
const LIMIT = parseInt(process.argv[2] || "0", 10);
const CONC = parseInt(process.argv[3] || "3", 10);

const CLAUDE_MD = `# Benchmark Agent

You are answering a long-term memory benchmark question.

## Startup (do all of these before answering)
1. Read \`memory/INDEX.json\`
2. Read \`memory/state/session.json\`
3. Read \`memory/entities/people/user.json\`
4. Read \`memory/logs/journal/current.jsonl\` — this is the full chronological chat history with the user. Every line is one turn with ts, session, role, content.

## Answering
- Use ONLY facts derivable from the journal. Do not guess.
- Pay attention to ts fields for temporal questions.
- If the user updated a fact later, the later value wins.
- If the evidence is not in the journal, say you do not know.
- Output ONLY the final answer as a single concise sentence. No preamble, no reasoning trace, no "based on the journal". Just the answer.
`;

const dirs = fs.readdirSync(ROOT).filter(d => {
  const qf = path.join(ROOT, d, "question.json");
  return fs.existsSync(qf);
});
const todo = LIMIT > 0 ? dirs.slice(0, LIMIT) : dirs;

// Resume support: skip already-answered question_ids
const done = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).question_id); } catch {}
  }
}

function runOne(qdir) {
  return new Promise((resolve) => {
    const q = JSON.parse(fs.readFileSync(path.join(ROOT, qdir, "question.json"), "utf8"));
    if (done.has(q.question_id)) return resolve(null);

    const workdir = path.join(ROOT, qdir);
    fs.writeFileSync(path.join(workdir, "CLAUDE.md"), CLAUDE_MD);

    const prompt = `Question date: ${q.question_date}\n\nQuestion: ${q.question}\n\nRead the memory files as instructed in CLAUDE.md, then output only the answer.`;

    const args = [
      "-p", prompt,
      "--permission-mode", "bypassPermissions",
      "--disallowedTools", "Bash,WebFetch,WebSearch,Agent,Task",
    ];
    const t0 = Date.now();
    const child = spawn("claude", args, { cwd: path.resolve(workdir), stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => out += d);
    child.stderr.on("data", d => err += d);
    const killer = setTimeout(() => child.kill("SIGKILL"), 120000);
    child.on("close", (code) => {
      clearTimeout(killer);
      const hyp = out.trim().split("\n").filter(Boolean).pop() || "";
      const rec = { question_id: q.question_id, hypothesis: hyp, question_type: q.question_type, gold: q.answer, ms: Date.now() - t0, exit: code };
      fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
      const goldStr = Array.isArray(q.answer) ? q.answer.join(" | ") : String(q.answer);
      console.log(`[${q.question_id}] ${code === 0 ? "ok" : "ERR"} ${rec.ms}ms  gold="${goldStr.slice(0,60)}"  hyp="${hyp.slice(0,80)}"`);
      if (code !== 0 && err) console.log("  stderr:", err.slice(0, 300));
      resolve(rec);
    });
  });
}

// Simple parallel worker pool
const queue = [...todo];
let active = 0;
await new Promise((done2) => {
  function pump() {
    while (active < CONC && queue.length) {
      const next = queue.shift();
      active++;
      runOne(next).finally(() => {
        active--;
        if (queue.length) pump();
        else if (active === 0) done2();
      });
    }
  }
  pump();
});
console.log("done");
