# Methodology

How each published LongMemEval number in this repo was produced.

## Dataset

LongMemEval Oracle (Wu et al., ICLR 2025), all 500 questions, six categories. No sampling on any published run. In the Oracle setting the evidence sessions are given to the system, so the benchmark measures how well the memory layer stores and surfaces them, not open retrieval over a large haystack.

## Two bases

LongMemEval results are reported two ways, and this repo shows both for every run:

- **ex-pref**: the 470 questions outside single-session-preference. Preference questions ask for a recommendation that fits a stated preference and have no fixed gold string, so string scorers cannot grade them.
- **all 500**: every question, with preference graded by a judge.

## Architectural runs (2026-04-15)

- **System:** Sibyl's file-based memory layout. Each question's sessions are ingested into a scratch directory (index, state, entity files, a chronological journal). The answering model reads those files directly.
- **Models:** Claude Opus 4.6 and Claude Sonnet 4.6.
- **Scoring:** scorer v3 on every question, then a manual review of answers the scorer flagged, then a Claude judge on the 30 preference questions. Published on the all-500 basis: 95.6% (Opus), 93.6% (Sonnet).
- **Scorer alone** on the same files: 94.5% / 89.0% (Opus) and 93.0% / 87.4% (Sonnet), ex-pref / all 500.

## Plugin run (2026-05-22)

- **System:** the shipped packages `sibyl-memory-hermes` 0.3.5 and `sibyl-memory-client` 0.4.2 from PyPI. Each question's sessions are written into the plugin's tiers: verbatim sessions, LLM-extracted entities, and a chronological event log.
- **Access:** the model reaches memory only through the plugin's tools (`sibyl_search`, `sibyl_recall`, `sibyl_list`), never by reading files.
- **Model:** Claude Sonnet 4.5 through the Anthropic API.
- **Scoring:** scorer v3 only, no manual step, no judge. Published on the ex-pref basis: 95.1%.
- **Run record:** `results/plugin/manifest.json`.

## Scorer

See the README for the five layers and the strict-mode numbers. The scorer is deterministic: the same hypotheses file always gives the same score.

## What this kit does not cover

- The plugin runner (Python) is not included; the kit reproduces the plugin score from the hypotheses, not the hypotheses themselves.
- Manual-review decisions on the architectural runs are reflected in `scores-*.jsonl` per question, not documented one by one.
- Answers vary run to run. A rerun of the plugin on the same packages will not match these hypotheses word for word.
