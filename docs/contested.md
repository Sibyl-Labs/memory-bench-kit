# Contested Benchmark Claims in the Memory Space

The agent memory benchmark space has active, public disputes between vendors. This document records the claims we are aware of and the sources disputing them. We include this because intellectual honesty about the state of measurement in this field is part of the work.

## Why this matters

When a vendor publishes a benchmark number, the number is only as trustworthy as:
1. The scorer (is it open source? can you run it?)
2. The judge model (which model evaluated the answers?)
3. The dataset (is the ground truth clean?)
4. The methodology (is the full run reproducible?)

Most vendors in the memory space publish none of these. We publish all four.

---

## Known disputes

### Mem0 vs Zep vs Letta (LoCoMo benchmark)

| Vendor | Claimed | Benchmark | Source |
|--------|---------|-----------|--------|
| Mem0 | 91.6% | LoCoMo | [mem0.ai/research](https://mem0.ai/research) |
| Zep | 75.14% (corrected) | LoCoMo | [blog.getzep.com](https://blog.getzep.com/) |
| Letta | varies | LoCoMo | [letta.com/blog/benchmarking-ai-agent-memory](https://www.letta.com/blog/benchmarking-ai-agent-memory) |

**Dispute chain:**
- Mem0 published 91.6% on LoCoMo with a GPT-4o-mini judge. Zep and Letta challenged the judge model choice as lenient.
- Mem0's published MemGPT baseline (~50s) was challenged by Letta (MemGPT's creator), who claims Mem0 misconfigured MemGPT for the comparison.
- Zep published higher numbers initially, then retracted and corrected downward to 75.14%.
- MemPalace issue #29 documents ~99 ground-truth errors in the LoCoMo dataset itself, suggesting an honest ceiling of ~93-94%.

---

## Our position

We publish:
- The scorer source code
- Raw per-question hypothesis files
- Run manifests with model versions, token counts, and costs
- Both v2 and v3 scorer results when the scorer changed
- This document acknowledging the contested landscape

If a number is wrong, you can find the bug. That is the standard we hold ourselves to, and the standard we think the field needs.

---

## Primary sources (verify fresh)

- **SIBYL LongMemEval:** [blog.sibylcap.com/longmemeval-v2](https://blog.sibylcap.com/longmemeval-v2)
- **SIBYL Plugin LongMemEval:** [blog.sibylcap.com/plugin-longmemeval](https://blog.sibylcap.com/plugin-longmemeval)
- **LongMemEval leaderboard:** [xiaowu0162.github.io/long-mem-eval](https://xiaowu0162.github.io/long-mem-eval/)
- **LoCoMo paper:** [arxiv.org/abs/2402.17753](https://arxiv.org/abs/2402.17753)
- **BEAM paper:** [arxiv.org/abs/2510.27246](https://arxiv.org/abs/2510.27246)
- **Mem0:** [mem0.ai/research](https://mem0.ai/research)
- **Zep:** [blog.getzep.com](https://blog.getzep.com/)
- **Letta:** [letta.com/blog/benchmarking-ai-agent-memory](https://www.letta.com/blog/benchmarking-ai-agent-memory)
