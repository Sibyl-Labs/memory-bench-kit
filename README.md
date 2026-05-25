<p align="center">
  <br />
  <strong>SIBYL MEMORY</strong>
  <br />
  <em>Benchmark Results & Reproducibility Kit</em>
  <br />
  <br />
  <a href="https://blog.sibylcap.com/longmemeval-v2">LongMemEval Report</a> · <a href="https://blog.sibylcap.com/plugin-longmemeval">Plugin Report</a> · <a href="https://sibylcap.com/memory">Product</a> · <a href="https://pypi.org/project/sibyl-memory-hermes/">PyPI</a>
</p>

<br />

<p align="center">
  <img src="https://img.shields.io/badge/LongMemEval-95.6%25_%23 2-8a6a2a?style=for-the-badge&labelColor=f5f1e6" alt="LongMemEval 95.6% #2" />
  <img src="https://img.shields.io/badge/Plugin-95.1%25_Sonnet_4.5-2d6e6a?style=for-the-badge&labelColor=f5f1e6" alt="Plugin 95.1%" />
  <img src="https://img.shields.io/badge/Architecture-file_based-15110a?style=for-the-badge&labelColor=f5f1e6" alt="File-based" />
  <img src="https://img.shields.io/badge/Vectors-zero-15110a?style=for-the-badge&labelColor=f5f1e6" alt="Zero vectors" />
</p>

---

## What this repo contains

Every benchmark result, scorer, methodology document, and raw hypothesis file behind Sibyl Memory's published numbers. The memory benchmark space has a credibility problem: vendors dispute each other's results, judge-shop for favorable models, and publish without reproducibility data. This repo is the antidote.

**Verify it yourself.**

```
memory-bench-kit/
  longmemeval/
    results/          per-question hypotheses, scores, and manifests
    scorer/           longmemeval-score.mjs (v3, open source)
    runner/           runner configs and sampling scripts
  docs/
    methodology.md    general benchmarking discipline
    contested.md      known disputed claims from other vendors
```

---

## Results at a glance

### LongMemEval Oracle (500 questions, ICLR 2025)

Three runs. Two architectures. Full 500-question dataset every time.

```
                          ┌─────────────────────────────────────────┐
                          │        LongMemEval Oracle (500Q)        │
                          ├──────────────────┬──────────────────────┤
                          │  Architecture    │  Plugin Packaging    │
                          │  (file-Read)     │  (tool-use API)      │
                          ├──────────────────┼──────────────────────┤
  Opus 4.6                │     95.6%        │         -            │
  Sonnet 4.6              │     93.6%        │         -            │
  Sonnet 4.5 + Plugin     │       -          │       95.1%          │
                          └──────────────────┴──────────────────────┘
```

#### Architectural Baseline (2026-04-15)

| Category | Opus 4.6 | Sonnet 4.6 |
|----------|----------|------------|
| single-session-user | 70/70 · **100%** | 70/70 · **100%** |
| single-session-assistant | 56/56 · **100%** | 56/56 · **100%** |
| temporal-reasoning | 128/133 · **96.2%** | 126/133 · **94.7%** |
| knowledge-update | 72/78 · **92.3%** | 75/78 · **96.2%** |
| multi-session | 124/133 · **93.2%** | 117/133 · **88.0%** |
| single-session-preference | 28/30 · **93.3%** | 24/30 · **80.0%** |
| **Overall (ex-pref)** | **95.6%** | **93.6%** |

> \#2 on the LongMemEval leaderboard, tied with Chronos (PwC). Only system above: agentmemory V4 at 96.2%.

**Infrastructure:** file-based, 4 vCPU / 16 GB EC2, zero vectors, zero embeddings, zero external retrieval.

#### Plugin Packaging (2026-05-22)

| Category | Plugin (Sonnet 4.5) | Architectural Ceiling (Opus 4.6) |
|----------|---------------------|----------------------------------|
| single-session-user | 68/70 · **97.1%** | 100% |
| single-session-assistant | 55/56 · **98.2%** | 100% |
| temporal-reasoning | 129/133 · **97.0%** | 96.2% |
| knowledge-update | 73/78 · **93.6%** | 92.3% |
| multi-session | 122/133 · **91.7%** | 93.2% |
| single-session-preference | 6/30 · **20.0%** | 93.3% |
| **Overall (ex-pref)** | **95.1%** | **95.6%** |

> The productized plugin on Sonnet 4.5 matches the Opus architectural ceiling within 0.5pp. On temporal-reasoning and knowledge-update, it exceeds it.

**Run cost:** $43.78 / 84.9 min wall clock / 0 errors across 500 questions.

---

## The scorer

The LongMemEval scorer is the most important file in this repo. It's what turns raw hypothesis text into a score. We publish it so anyone can verify our numbers or run it against their own system.

**Location:** [`longmemeval/scorer/longmemeval-score.mjs`](longmemeval/scorer/longmemeval-score.mjs)

**Version:** v3 (4 matching layers + multi-alternative gold split)

```
Layer 0  Substring match (original LongMemEval behavior)
Layer 1  Abstention match (both gold and hypothesis say "don't know")
Layer 2  Pronoun normalization (my/your, I/you perspective swap)
Layer 3  Number + abbreviation normalization ("fourteen" -> "14", "UCLA" -> full name)
Layer 4  Token overlap (60% threshold, paraphrase detection)
  +v3    Multi-alternative gold split for temporal-reasoning format
```

**Scorer transparency:** The v2 scorer produced 88.1% on the plugin run. Diagnosis found 32 of 36 temporal-reasoning misses were scorer false-negatives on LongMemEval's multi-alternative gold format. The v3 fix recovered 33 answers (+7.0pp). We publish both numbers. The hypotheses are immutable. The scorer was the bug.

```bash
# Run the scorer yourself
node longmemeval/scorer/longmemeval-score.mjs longmemeval/results/plugin/hypotheses-v4-plugin.jsonl

# Run in strict mode (v1 substring-only)
node longmemeval/scorer/longmemeval-score.mjs longmemeval/results/plugin/hypotheses-v4-plugin.jsonl --strict
```

---

## Reproducibility

### LongMemEval Plugin Run

| Field | Value |
|-------|-------|
| Run ID | `v4-20260522T204716Z-11b1fb89` |
| Dataset | LongMemEval Oracle, 500 questions (full, no sampling) |
| Model | `claude-sonnet-4-5` (Anthropic API) |
| Plugin | [`sibyl-memory-hermes`](https://pypi.org/project/sibyl-memory-hermes/) 0.3.5 + [`sibyl-memory-client`](https://pypi.org/project/sibyl-memory-client/) 0.4.2 |
| Architecture | HOT (verbatim sessions) + WARM (LLM-extracted entities) + COLD (chronological events) |
| Access | Tool-use API (`sibyl_search` / `sibyl_recall` / `sibyl_list`) |
| Concurrency | 3 |
| Wall clock | 5,093s (84.9 min) |
| Tokens | 9.95M input, 928K output |
| Cost | $43.78 ($0.088/question) |
| Errors | 0 / 500 |

### LongMemEval Architectural Baseline

| Field | Value |
|-------|-------|
| Dataset | LongMemEval Oracle, 500 questions |
| Models | Claude Opus 4.6 (primary), Claude Sonnet 4.6 (secondary) |
| Architecture | File-based memory, direct Claude file-Read access |
| Infrastructure | 4 vCPU / 16 GB RAM EC2, zero vectors, zero embeddings |
| Publication | 2026-04-15 |

---

## Packages

| Package | Version | PyPI |
|---------|---------|------|
| `sibyl-memory-cli` | 0.3.8 | [pypi.org/project/sibyl-memory-cli](https://pypi.org/project/sibyl-memory-cli/) |
| `sibyl-memory-hermes` | 0.3.5 | [pypi.org/project/sibyl-memory-hermes](https://pypi.org/project/sibyl-memory-hermes/) |
| `sibyl-memory-mcp` | 0.1.2 | [pypi.org/project/sibyl-memory-mcp](https://pypi.org/project/sibyl-memory-mcp/) |

---

## Known contested claims from other vendors

The memory benchmark space has active disputes. We document them here for context.

| Vendor | Claimed Score | Benchmark | Contested By | Issue |
|--------|--------------|-----------|--------------|-------|
| Mem0 | 91.6% | LoCoMo | Zep, Letta | Judge model lenient, MemGPT baseline disputed |
| Zep | 75.14% | LoCoMo | Self-corrected | Earlier higher numbers redacted |
| MemGPT (Mem0 config) | ~50s | LoCoMo | Letta | Letta says Mem0 misconfigured MemGPT |
| Any LoCoMo number | varies | LoCoMo | MemPalace #29 | ~99 ground-truth errors documented |

We publish our scorer, hypotheses, and methodology. If a number is wrong, you can find the bug.

---

## Reports

Full analysis with visualizations, architecture deep-dives, and competitive context:

- [LongMemEval Architectural Baseline](https://blog.sibylcap.com/longmemeval-v2) (2026-04-15)
- [LongMemEval Plugin Packaging](https://blog.sibylcap.com/plugin-longmemeval) (2026-05-22)

---

## License

MIT. The scorer, methodology documents, and result summaries are freely usable. Raw hypothesis files are provided for verification purposes.

---

<p align="center">
  <br />
  <a href="https://sibyllabs.org">Sibyl Labs LLC</a> · <a href="https://sibylcap.com/memory">Sibyl Memory</a> · <a href="https://x.com/sibylcap">@sibylcap</a>
  <br />
  <br />
  <em>file-based memory. zero vectors. verify it yourself.</em>
</p>
