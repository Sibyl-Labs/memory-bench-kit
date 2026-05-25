#!/usr/bin/env node
// Semantic judge for LongMemEval preference questions.
// Uses claude -p with no MCP servers to evaluate whether the hypothesis
// demonstrates knowledge of the user's preference described in the gold.
//
// Usage: node scripts/bench/longmemeval-judge.mjs [hypotheses.jsonl] [concurrency]

import fs from "fs";
import { spawn } from "child_process";

const FILE = process.argv.filter(a => !a.startsWith("--"))[2] || "bench/hypotheses.jsonl";
const CONC = parseInt(process.argv[3] || "2", 10);
const OUT = "bench/judge-results.jsonl";

const records = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const prefs = records.filter(r => r.question_type === "single-session-preference" && r.hypothesis);

console.log(`${prefs.length} preference questions to judge (concurrency ${CONC})`);

// Resume support
const done = new Set();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).question_id); } catch {}
  }
}

function judge(rec) {
  return new Promise((resolve) => {
    if (done.has(rec.question_id)) return resolve(null);

    const goldStr = Array.isArray(rec.gold) ? rec.gold.join("\n") : String(rec.gold);
    const prompt = `You are a benchmark judge. Determine whether the HYPOTHESIS demonstrates knowledge of the user's preference described in the GOLD answer. The hypothesis does not need to match the gold word-for-word. It needs to show that the system understood and applied the user's preference.

GOLD (expected preference):
${goldStr}

HYPOTHESIS (system's answer):
${rec.hypothesis}

Does the hypothesis demonstrate knowledge of the user's preference described in the gold? Answer ONLY "YES" or "NO". Nothing else.`;

    const args = [
      "-p", prompt,
      "--permission-mode", "bypassPermissions",
      "--disallowedTools", "Bash,WebFetch,WebSearch,Agent,Task,Read,Write,Edit,Glob,Grep",
      "--model", "sonnet",
    ];

    const t0 = Date.now();
    const child = spawn("claude", args, {
      cwd: "/tmp",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DISABLE_MCP: "1" },
    });

    let out = "", err = "";
    child.stdout.on("data", d => out += d);
    child.stderr.on("data", d => err += d);
    const killer = setTimeout(() => child.kill("SIGKILL"), 60000);

    child.on("close", (code) => {
      clearTimeout(killer);
      const answer = out.trim().split("\n").filter(Boolean).pop() || "";
      const correct = /^yes$/i.test(answer.trim());
      const result = {
        question_id: rec.question_id,
        gold: goldStr.slice(0, 120),
        hypothesis: rec.hypothesis.slice(0, 120),
        judge_raw: answer.slice(0, 20),
        correct,
        ms: Date.now() - t0,
      };
      fs.appendFileSync(OUT, JSON.stringify(result) + "\n");
      console.log(`[${rec.question_id}] ${correct ? "YES" : "NO "}  ${result.ms}ms  gold="${goldStr.slice(0, 60)}"  hyp="${rec.hypothesis.slice(0, 60)}"`);
      resolve(result);
    });
  });
}

// Worker pool
const queue = prefs.filter(r => !done.has(r.question_id));
console.log(`${queue.length} to judge (${done.size} already done)`);

let active = 0;
let judged = 0, correct = 0;

await new Promise((finish) => {
  if (queue.length === 0) return finish();
  function pump() {
    while (active < CONC && queue.length) {
      const next = queue.shift();
      active++;
      judge(next).then((r) => {
        active--;
        if (r) { judged++; if (r.correct) correct++; }
        if (queue.length) pump();
        else if (active === 0) finish();
      });
    }
  }
  pump();
});

// Read all results and summarize
const allResults = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).map(JSON.parse);
const totalCorrect = allResults.filter(r => r.correct).length;
console.log(`\nJudge complete: ${totalCorrect}/${allResults.length} = ${(totalCorrect / allResults.length * 100).toFixed(1)}%`);
