<p align="center">
  <br />
  <strong>SIBYL MEMORY</strong>
  <br />
  <em>Benchmark results and scoring kit</em>
  <br />
  <br />
  <a href="https://blog.sibylcap.com/longmemeval-v2">Architecture report</a> · <a href="https://blog.sibylcap.com/plugin-longmemeval">Plugin report</a> · <a href="https://sibyllabs.org/products/memory">Product</a> · <a href="https://github.com/Sibyl-Labs/Sibyl-Memory">Source</a>
</p>

<br />

<p align="center">
  <img src="https://img.shields.io/badge/Plugin-95.1%25_Sonnet_4.5-2d6e6a?style=for-the-badge&labelColor=f5f1e6" alt="Plugin 95.1% on LongMemEval, Sonnet 4.5" />
  <img src="https://img.shields.io/badge/Architecture-95.6%25_Opus_4.6-8a6a2a?style=for-the-badge&labelColor=f5f1e6" alt="Architecture 95.6% on LongMemEval, Opus 4.6" />
  <img src="https://img.shields.io/badge/Vectors-zero-15110a?style=for-the-badge&labelColor=f5f1e6" alt="Zero vectors" />
</p>

---

## What this repo contains

The per-question hypotheses, the scorer, and the score files behind Sibyl Memory's published LongMemEval numbers. Run the scorer on the published hypotheses and check the arithmetic yourself.

```
memory-bench-kit/
  longmemeval/
    results/
      architectural/   Opus and Sonnet hypotheses + published scores (2026-04-15)
      plugin/          plugin hypotheses, run manifest, scores (2026-05-22)
    scorer/            longmemeval-score.mjs (v3)
    runner/            ingest / run / judge scripts from the architectural pipeline
  docs/
    methodology.md     how each number was produced, and what the kit does not cover
```

**Scope.** The kit verifies scoring: given the published hypotheses, you can reproduce every score below. It does not reproduce generation end to end. The plugin run used a Python runner that is not included here; its configuration is recorded in `longmemeval/results/plugin/manifest.json`.

---

## Results

LongMemEval Oracle (ICLR 2025), 500 questions, full dataset on every run. LongMemEval reports two bases: **ex-pref** excludes the 30 single-session-preference questions (470 scored), **all 500** includes them. Both are shown for every run.

| Run | Date | Model | ex-pref | all 500 |
|---|---|---|---|---|
| Plugin (`sibyl-memory-hermes` 0.3.5 + `sibyl-memory-client` 0.4.2) | 2026-05-22 | Claude Sonnet 4.5 | **95.1%** (447/470) | 90.6% (453/500) |
| Architecture, file-Read | 2026-04-15 | Claude Opus 4.6 | 95.7% (450/470) | **95.6%** (478/500) |
| Architecture, file-Read | 2026-04-15 | Claude Sonnet 4.6 | 94.5% (444/470) | **93.6%** (468/500) |

Bold marks the basis each number was originally published on.

**How the scores were produced.** The plugin score is the scorer's output, with no manual step. The architectural scores combine the scorer with a manual review of flagged answers and a Claude judge on the 30 preference questions, which have no fixed gold string. Run the scorer alone on the architectural files and it prints:

| Architectural file | scorer only, ex-pref | scorer only, all 500 |
|---|---|---|
| Opus 4.6 | 94.5% (444/470) | 89.0% (445/500) |
| Sonnet 4.6 | 93.0% (437/470) | 87.4% (437/500) |

The gap is mostly the preference category (scorer 1/30 and 0/30 against judged 28/30 and 24/30), plus 6 (Opus) and 7 (Sonnet) manual overrides in the other categories. See [`docs/methodology.md`](docs/methodology.md).

**Ranking.** On 2026-04-15 the 95.6% Opus run placed #2 on the LongMemEval leaderboard, tied with Chronos (PwC), behind agentmemory V4 at 96.2%. That ranking is dated and has not been re-checked since.

**Independent reproduction.** In June 2026 an outside tester re-ran LongMemEval Oracle against the published plugin with a deterministic, rule-based judge and reported about 95.2%.

### Per category

| Category | Plugin, Sonnet 4.5 | Architecture, Opus 4.6 | Architecture, Sonnet 4.6 |
|---|---|---|---|
| single-session-user | 68/70 · 97.1% | 70/70 · 100% | 70/70 · 100% |
| single-session-assistant | 55/56 · 98.2% | 56/56 · 100% | 56/56 · 100% |
| temporal-reasoning | 129/133 · 97.0% | 128/133 · 96.2% | 126/133 · 94.7% |
| knowledge-update | 73/78 · 93.6% | 72/78 · 92.3% | 75/78 · 96.2% |
| multi-session | 122/133 · 91.7% | 124/133 · 93.2% | 117/133 · 88.0% |
| single-session-preference | 6/30 · 20.0% | 28/30 · 93.3% | 24/30 · 80.0% |

Like for like on ex-pref, the plugin on Sonnet 4.5 (95.1%) lands within 0.6 points of the architecture on Opus 4.6 (95.7%). The plugin's weak spot is preference questions, which the ex-pref basis leaves out.

**Plugin run:** run id `v4-20260522T204716Z-11b1fb89`, concurrency 3, 84.9 min wall clock, 9.95M input / 928K output tokens, $43.78 at list price, 0 errors.

---

## The scorer

[`longmemeval/scorer/longmemeval-score.mjs`](longmemeval/scorer/longmemeval-score.mjs), v3.

```
Layer 0  Substring match, either direction (original LongMemEval behavior)
Layer 1  Abstention match (gold and hypothesis both say "don't know")
Layer 2  Pronoun normalization (my/your, I/you)
Layer 3  Number and abbreviation normalization ("fourteen" -> "14")
Layer 4  Token overlap, 60% threshold (paraphrase)
  +v3    Multi-alternative gold split for the temporal-reasoning format
```

```bash
node longmemeval/scorer/longmemeval-score.mjs longmemeval/results/plugin/hypotheses-v4-plugin.jsonl
node longmemeval/scorer/longmemeval-score.mjs longmemeval/results/plugin/hypotheses-v4-plugin.jsonl --strict
```

**v2 to v3.** Under the v2 scorer the plugin run scored 88.1%. 32 of 36 temporal-reasoning misses were false negatives on LongMemEval's two-answer gold format ("X days. Y days (including the last day) is also acceptable."). v3 splits that format and recovered 33 answers. The hypotheses did not change. Both score files are in `results/plugin/`.

### Limitations

The fuzzy layers are lenient by design and you should know by how much:

- **Strict mode** (`--strict`, substring only) scores the same files at 71.3% (plugin), 74.7% (Opus) and 70.6% (Sonnet) ex-pref. Layers 1 to 4 recover 93 to 112 answers per run.
- **Layer 0** matches substrings in either direction, so a long answer that names both options of an "A or B" question can pass whichever it chose.
- **Layer 4** passes at 60% token overlap with partial-token matching.

An order-aware check for two-option questions is on the list. The independent rule-based reproduction above is the cross-check we point to.

---

## Notes on the data

- The architectural Sonnet run used Claude Sonnet 4.6. The `model` field in `hypotheses-sonnet.jsonl` reads `claude-sonnet-4-20250514` on every row: that is a stale ID string written when the file was exported, not the model that answered. The rows are left as published so the file's hash does not change.
- `results/plugin/manifest.json` is the raw run record and is kept as written, including its internal script path for the scorer.

---

## Reports

- [LongMemEval: architectural baseline](https://blog.sibylcap.com/longmemeval-v2) (2026-04-15)
- [LongMemEval: plugin packaging](https://blog.sibylcap.com/plugin-longmemeval) (2026-05-22)

---

## License

MIT. Copyright (c) 2026 Sibyl Labs, LLC.

<p align="center">
  <br />
  <a href="https://sibyllabs.org">Sibyl Labs</a> · <a href="https://sibyllabs.org/products/memory">Sibyl Memory</a> · <a href="https://github.com/Sibyl-Labs/Sibyl-Memory">GitHub</a>
  <br />
  <br />
  <em>file-based memory. zero vectors. check the arithmetic.</em>
</p>
