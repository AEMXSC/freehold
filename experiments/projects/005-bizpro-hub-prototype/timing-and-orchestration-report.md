# Run #005 — Timing & Orchestration Analysis

Per-phase wall-clock timings for the BizPro Hub conversion, plus
forward-looking notes on what could parallelize and which model /
thinking level fits each step. Per the user's brief: analysis only,
nothing implemented.

---

## Wall-clock timings (measured)

```
phase          duration    min:sec  notes
─────────      ──────────  ───────  ────────────────────────────
capture        118s          1m58s  curl + asset probe + folder init
analyze        215s          3m35s  structural map + decisions write-up
generate       639s         10m39s  subagent (general-purpose)
wire            28s          0m28s  cp + transform + lint
roundtrip      447s          7m27s  dev server + Playwright + bug fix
                                    (~150s of the 447s was the
                                     wrap-link bug investigation + fix)
reflect        325s          5m25s  notes + learnings + this report
─────────      ──────────  ───────
sum            1772s        29m32s  measured phase time
```

Between-phase orchestration overhead: 18 + 19 + 32 + 12 = 81s (~1.4m)
of "main agent setting up the next phase" — small but measurable.

Reference point: run #001 (Stardust Semrush home, much smaller input)
ran in roughly the same total time; run #004 (Heathrow, 10 KB input)
ran in less. Source size is NOT linear in wall-clock — the Generate
phase dominates regardless of input size, because it's almost entirely
LLM time.

## What could be parallelized

Looking at the phase graph, several opportunities exist. Each is
described with what would parallelize and what (if anything) would
need to change to enable it.

### 1. Capture-phase asset fetches (small win, ~30-60s)

Today: serial `curl` of the main HTML, then individual `curl` of each
external asset.

Could be: fan out all asset URLs from the head's `<link>`s and
external `<script src>` to parallel curl calls. With ~3 external
assets (lenis.min.css, lenis.min.js, the main HTML) in this run, the
savings are small. For sources with many external libs (Stardust
0.3 used 4-5 CDN links), it grows.

**No substrate change needed** — just batch the curl invocations.

### 2. Analyze can run partly during Capture (medium win, ~60-120s)

Today: Capture finishes; then Analyze reads the file.

Could be: as soon as the main HTML lands, kick off `head`, `grep`,
and structural map reads in parallel (multi-tool-call batch). The
asset fetches continue in the background.

**No substrate change needed** — just sequence the tool calls
differently in the main agent.

### 3. Generate sub-tasks (big win, ~300s+)

Today: ONE subagent does everything — read methodology, read learnings,
read source, write template, write fragments, write CSS, write
animations.js, write DA doc.

Could be: **fan out per-block** to multiple subagents in parallel:
- Subagent A: write `header.html` fragment
- Subagent B: write `footer.html` fragment
- Subagent C: write `bizpro-hub.css` from inline `<style>`
- Subagent D: write `bizpro-hub-animations.js` from inline `<script>`
- Subagent E: write 8 sections of the template + DA doc
  (still one agent because slots must be consistent across template
  and DA, and section names must match)

The biggest unit (Subagent E) is still long, but B/C/D are mechanical
extractions (~10-30s each) that today run sequentially within the
single subagent's 10-minute window.

Expected savings: 4-6 minutes off Generate if the 4 mechanical agents
run in parallel with the template+DA agent.

**No substrate change needed** — the main agent issues 4-5 Agent
tool calls in one message. Coordination cost: pass a shared "section
list + slot naming convention" string to all 5 subagents up-front.

### 4. Wire + lint parallelism (tiny win, ~10s)

Today: cp files, then run `npm run lint`.

Could be: cp files, then in parallel run `npm run lint` AND
`node experiments/knowledge/tools/transform-da-to-eds.mjs …` (the
draft-builder). Today they're serial; both take ~5s.

**No substrate change needed.**

### 5. Round-trip local + production (medium win when prod runs)

Today: local round-trip first, fix any issues, then production.

Could be: when local passes its sanity check (overlay applied, sections
present), kick off the production PUT + POST preview in the background
while continuing to capture screenshots locally. Both surfaces converge
on a `playwright.navigate` call when ready.

**No substrate change needed.** Caveat: only meaningful when production
round-trip is part of the run — for run #005 it was skipped.

### 6. Memory + learnings update during Reflect (small win)

Today: Reflect writes notes.md, then learnings.md, then methodology.md
sequentially.

Could be: 3 separate `Write` tool calls batched into one message.

**No substrate change needed.**

### Parallelism summary

| Phase | Today | With parallelism | Win |
|---|---|---|---|
| Capture | 118s | ~60-90s | 30-60s |
| Analyze | 215s | overlaps Capture | 60-120s |
| Generate | 639s | ~300-400s | 240-340s |
| Wire | 28s | ~20s | 8-10s |
| Round-trip | 447s | unchanged for local-only | 0-150s if prod runs |
| Reflect | ~600s | ~480s | 120s |
| **Total estimate** | **~35m** | **~22-25m** | **~10-13m** |

Biggest lever is the Generate phase — single subagent handles too
much work serially today.

---

## Model + thinking-level recommendations (by phase)

Default model in this session is Claude Opus 4.7 (1M context). Cost
and latency matter, especially for the long Generate phase.

| Phase | Recommended primary | Thinking | Why |
|---|---|---|---|
| **Capture** | Haiku 4.5 (parent) | none | Mechanical: curl, save, count lines, grep. No reasoning required. |
| **Analyze** | Opus 4.7 (parent) | medium ("think") | Structural decisions: which sections, what slots, what to strip, how to disambiguate. Mistakes here cascade through the rest of the run. |
| **Generate** | Sonnet 4.6 subagents | medium ("think") | Large volume of mechanical-but-structured work: extracting markup, writing slot markers, building the DA doc. Sonnet handles this well at lower cost than Opus; the methodology + learnings give it the rules it needs. Opus only needed if there are tricky judgment calls (e.g., novel slot patterns). |
| **Wire** | Haiku 4.5 (parent) | none | cp, lint, transform — pure mechanical. |
| **Round-trip** | Sonnet 4.6 (parent) | low ("think briefly") | Probing rendered DOM, taking screenshots, deciding "this looks right". Bug investigation (when something fails) wants higher reasoning — escalate to Opus only for the diagnosis call, not the routine "passes/fails" verification. |
| **Reflect** | Opus 4.7 (parent) | medium-high ("think harder") | This is where cross-project learnings get distilled. The decisions about WHAT to promote and HOW to phrase the generic rule outlive the conversation. Worth the model spend. |

### Why "thinking level" matters per phase

- **Capture/Wire** are deterministic — extended thinking buys nothing.
  Cheap model + no thinking = right answer in seconds.

- **Generate** is high-volume but rule-bound. Methodology +
  learnings encode most of the judgment. The subagent's job is to
  apply rules consistently, not invent them. Sonnet + brief thinking
  produces consistent output; Opus would be slower without better
  results for this shape of work. Where Opus DOES pay off: novel
  patterns (a new slot writer, an unusual block shape). When the
  subagent encounters one, it should escalate.

- **Analyze + Reflect** are where wrong calls have the largest blast
  radius. Analyze decisions get baked into the converted artifacts;
  Reflect decisions get baked into methodology that future runs
  follow. These warrant the strongest model + most thinking budget.

- **Round-trip** is mixed: routine checks are cheap, but failure
  diagnosis can be deep. Two-tier: cheap+fast for the green path,
  Opus-with-thinking for triage.

### Concrete recommendations for run #006+

1. **Multi-subagent Generate.** Split mechanical extractions
   (header, footer, CSS, animations) from the template+DA agent.
   4-5 parallel subagents on Sonnet 4.6. Saves ~4-6 minutes.

2. **Cheaper Wire.** Haiku 4.5 for the cp + lint + transform step.
   Quality requirement is just "files in place, lint passes."

3. **Spec-mode Analyze.** Have Analyze produce a JSON
   `decisions.json` artifact that the Generate subagents read.
   Today the decisions live in markdown prose in `notes.md` which
   subagents have to re-parse. A structured artifact removes one
   layer of LLM re-interpretation.

4. **Round-trip diagnostic agent.** When a screenshot reveals
   broken rendering, dispatch a focused subagent (Opus, "think
   harder") with the specific symptom + relevant template+DA snippets
   to diagnose. Today the main agent absorbs that work itself.

5. **Move boilerplate context to a Skill.** The user's stated
   end-state is a Claude Code skill, not a CLI. Once we have the
   skill, common context (methodology rules, slot writer reference,
   "don't slot nested children" etc.) loads once per invocation
   instead of every subagent re-reading the same files. Token
   savings + faster startup.

---

## Notable inefficiencies observed in run #005

- **Wrap-link bug took ~150s to find and fix.** Three Playwright
  evaluate calls + one DOM inspection + the sed-based fix + re-test.
  A guardrail (lint rule? template validator?) that catches
  "container has nested data-slot children" at Generate time would
  prevent this class of bug entirely. Worth a small substrate
  addition for run #006.

- **Reading the full source (2687 lines, 120 KB) into the Analyze
  phase.** The subagent for Generate ALSO has to read it. Could
  pre-extract:
  - `head-links.txt` (just the head `<link>`s the template needs to lift)
  - `inline-style.css` (just the `<style>` block extracted)
  - `inline-script.js` (just the `<script>` blocks extracted)
  - `body-sections.html` (just `<body>` content)
  - `assets.json` (list of all asset URLs)

  Each subagent then reads only what it needs. Reduces token use in
  Generate by maybe 30-50%.

- **Three "task reminder" system messages during this run** —
  triggered when more than ~6-8 tool calls happen without a
  TaskUpdate. The reminder cycle is fine in principle but the
  cadence felt high. Could be tuned, OR the agent should
  proactively call TaskList+TaskUpdate at every phase boundary
  (which would also make this report easier to generate from
  task metadata rather than wall-clock).
