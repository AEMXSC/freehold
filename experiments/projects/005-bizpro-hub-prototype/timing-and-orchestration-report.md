# Run #005 — Final Report

Conversion of Adobe BizPro Hub prototype
(`http://127.0.0.1:8080/acom-bespoke-pages/bizpro-hub-prototype/`) into
an EDS overlay page. Covers what shipped, how it went, where it went
sideways, and the analysis the user asked for up-front: parallelization
opportunities and best-fit model + thinking level per phase.

---

## 1. What shipped

**Deployed at** `https://sf-overlay-exp-005--snowflake--aemcoder.aem.page/sf-overlay-exp-005/home`
on branch `sf-overlay-exp-005` (HEAD `00cf2d4`).

| Artifact | Path | Size |
|---|---|---|
| Template | `templates/bizpro-hub.html` | 33.9 KB |
| Header fragment | `fragments/bizpro-hub/header.html` | 1.3 KB |
| Footer fragment | `fragments/bizpro-hub/footer.html` | 7.0 KB |
| Page CSS | `styles/bizpro-hub.css` | 51.6 KB |
| Lenis CSS (vendored) | `styles/bizpro-hub-lenis.min.css` | 457 B |
| Animations JS | `scripts/bizpro-hub-animations.js` | 26.3 KB |
| Lenis JS (vendored) | `scripts/bizpro-hub-lenis.min.js` | 17.4 KB |
| Source assets (vendored) | `assets/...` | 38 MB / 72 files |
| DA-source body fragment | `…/sf-overlay-exp-005/home.html` | 15.5 KB |

113 `[data-slot]` markers across 8 content blocks + 1 metadata block.
9 product cards, 4 story cards, 3 tutorial slides, 3 pricing cards,
6 acrobat-feature card slots, 1 hero block, 1 banner, 1 search section.

Largest source we've handled: 2687 lines / 120 KB HTML, 1319-line
inline `<style>`, 520 lines of inline JS, 72 referenced assets including
18 self-hosted OTF fonts.

**End-to-end verified:** local + production round-trip both green. 0
console errors on the production preview. Adobe Clean / Adobe Clean
Display fonts loading. Story photos optimised via Media Bus
(`./media_<sha>.png?width=750&format=webply&optimize=medium`).
DA-authored content flowing through the overlay engine cleanly.

## 2. Wall-clock timings

```
phase             duration    min:sec  notes
─────────         ──────────  ───────  ────────────────────────────
capture            118s         1m58s  curl + asset probe + folder init
analyze            215s         3m35s  structural map + decisions write-up
generate           639s        10m39s  single subagent (general-purpose)
wire                28s         0m28s  cp + transform + lint
roundtrip-local    447s         7m27s  dev server + Playwright + slot-bug fix
                                       (~150s of the 447s was bug triage)
reflect-1          325s         5m25s  notes + global learnings + report v1
─────────         ──────────  ───────
                  1772s        29m32s  agent-active time for initial run

USER REVIEW       ~600s        ~10m    "Did you push to DA?" → "What about
                                       vendoring /assets/ as code?" — user
                                       caught two unilateral narrowings.

follow-up:
  vendor + wire    ~900s        ~15m   cp assets, sed rewrites, lint,
                                       dev server restart, local verify
  branch + push   ~  60s        ~1m    git checkout, add, commit, push
  da PUT + prev   ~  10s        ~0.2m  curl, curl
  prod verify     ~  80s        ~1.3m  Playwright nav, console, evaluate
  media-bus fix    ~120s        ~2m    diagnose about:error, sed, re-PUT,
                                       re-preview, re-verify in Playwright
  docs + audit     ~600s        ~10m   notes update, learnings update,
                                       memory entry, methodology updates,
                                       commit, push
─────────         ──────────  ───────
follow-up sum     ~1770s        ~29m   roughly same as initial run

GRAND TOTAL       ~3540s + ~600s user = ~70 min wall clock end-to-end
```

Reference: run #004 Heathrow (10 KB source) was ~22 min total without
production-asset issues. Run #005's source was 12× larger AND hit the
local-only assets problem AND surfaced two new bugs (wrap-link slot,
Media-Bus URL rule). Worth the 70 min in learning value.

### Active-time breakdown

```
Capture          3.3%
Analyze          6.0%
Generate        17.9%  ← largest single phase
Wire             0.8%
Round-trip       7.6%  initial local
Reflect          9.1%
Follow-up vendor 16.9%
Follow-up docs   16.9%
Other            21.5%  including user-review pauses
                100%
```

## 3. What could be parallelized

### 3.1 Capture-phase asset fetches (small win, ~30-60s)

Today: serial `curl` for the main HTML, then individual `curl` per
external asset.

Could be: fan out all asset URLs to parallel curl calls. With ~3
external assets in this run the savings are tiny. For sources with
many CDN-linked libs the win grows.

**No substrate change needed** — just batch the curl invocations.

### 3.2 Analyze can overlap Capture (medium win, ~60-120s)

Today: Capture finishes, then Analyze reads the file.

Could be: as soon as the main HTML is on disk, kick off structural
reads in parallel (one batch of `head`, `grep`, line-count tool
calls). Asset fetches continue in the background.

**No substrate change needed.**

### 3.3 Generate sub-tasks (BIG win, ~300s+)

Today: ONE subagent does everything — reads methodology, reads
learnings, reads source, writes template, writes fragments, writes
CSS, writes animations.js, writes DA doc. 639s serial.

Could be: fan out across 4-5 parallel subagents:
- **A** — `header.html` fragment
- **B** — `footer.html` fragment
- **C** — `bizpro-hub.css` from inline `<style>` (mechanical extraction)
- **D** — `bizpro-hub-animations.js` from inline `<script>` (with the
  library-loader prelude)
- **E** — template (with `[data-slot]` markers) + DA doc (block tables,
  metadata) **together**, because slot names must be consistent across
  the two files

Subagent E is still the long pole (the actual conversion work), but
A/B/C/D are short mechanical extractions that today wait their turn
inside the single subagent's 10-min window. Expected savings on
Generate: 4-6 minutes.

**No substrate change needed** — main agent issues 4-5 Agent tool
calls in a single message. Coordination cost: produce a shared
"section list + slot naming convention" artifact during Analyze
that all 5 subagents reference.

### 3.4 Wire + drafts build (tiny win, ~10s)

Today: cp files, then `npm run lint`, then `transform-da-to-eds.mjs`.

Could be: cp first, then parallel `lint` + `transform`. Both take ~5s.

**No substrate change needed.**

### 3.5 Round-trip local + production (medium win, ~150s when prod runs)

Today: local first, find any bugs, fix, then production.

Could be: as soon as local's structural sanity check passes (overlay
applied, sections present), kick off git push + DA PUT + admin POST
preview in the background while continuing to screenshot locally.
Both surfaces converge when the production Playwright nav happens.

**No substrate change needed.** Only meaningful when production
round-trip is in scope (which it should be by default — see lessons
in §5).

### 3.6 Reflect's write-up (small win, ~120s)

Today: notes.md write, then learnings.md write, then methodology.md
write — serial.

Could be: batch 3 Edit calls in one message.

**No substrate change needed.**

### Parallelism summary

| Phase | Today | With parallelism | Win |
|---|---|---|---|
| Capture | 118s | ~60-90s | 30-60s |
| Analyze | 215s | overlaps with Capture | 60-120s |
| Generate | 639s | ~300-400s | 240-340s |
| Wire | 28s | ~20s | 8-10s |
| Round-trip | 447s | overlaps push/PUT/preview | 150s+ |
| Reflect | 325s | ~200s | 120s |
| **Total estimate (active)** | **~30m** | **~18-22m** | **~10-12m** |

**Biggest lever:** Generate. Today one subagent does too much serially.

## 4. Best model + thinking level per phase

Default model in this session is Claude Opus 4.7 (1M context). Cost
and latency matter — especially for the Generate phase, which today
dominates token spend.

| Phase | Recommended | Thinking | Why |
|---|---|---|---|
| **Capture** | Haiku 4.5 (parent) | none | curl, save, count lines, grep. Deterministic, no judgment. |
| **Analyze** | Opus 4.7 (parent) | medium ("think") | Decisions cascade through every later phase. Worth strongest model + thinking budget. |
| **Generate** | Sonnet 4.6 (subagents) | medium ("think") | High-volume but rule-bound work. Methodology + learnings encode most judgment; subagent applies rules. Opus only when novel patterns appear. |
| **Wire** | Haiku 4.5 (parent) | none | cp + lint + transform. Pure mechanical. |
| **Round-trip (green path)** | Sonnet 4.6 (parent) | low ("think briefly") | Probe DOM, screenshot, verify "looks right". Cheap + fast. |
| **Round-trip (failure triage)** | Opus 4.7 (subagent) | high ("think harder") | When something breaks, deep reasoning pays. Dispatch a focused subagent with the symptom + relevant code snippets. |
| **Reflect** | Opus 4.7 (parent) | medium-high ("think harder") | Cross-project rules get written here. They outlive the conversation. Worth the spend. |

### Why "thinking level" matters per phase

- **Capture / Wire** are deterministic — extended thinking buys
  nothing. Cheap model + no thinking = right answer in seconds.

- **Generate** is high-volume but rule-bound. Methodology + learnings
  encode most of the judgment. The subagent's job is to apply rules
  consistently, not invent them. Sonnet + brief thinking produces
  consistent output; Opus would be slower without producing measurably
  better artifacts. Where Opus DOES pay off: novel patterns (a new
  slot writer case, an unusual block shape). When a subagent
  encounters something the methodology doesn't cover, it should
  escalate to the main (Opus) agent rather than improvise.

- **Analyze + Reflect** are where wrong calls have the largest blast
  radius. Analyze decisions get baked into the converted artifacts.
  Reflect decisions get baked into methodology that future runs
  follow. Worth strongest model + most thinking.

- **Round-trip** is mixed: routine "is the page rendering" checks are
  cheap, but failure diagnosis can be deep (see §5.1 below for two
  concrete examples). Two-tier: cheap+fast for the green path,
  Opus-with-thinking for triage.

## 5. What went sideways — and what to do about it

Two classes of bug surfaced in run #005, plus one user-feedback
correction.

### 5.1 Two preventable bugs

**5.1.1 Wrap-link slot bug** (cost: ~150s diagnose + fix in local
round-trip). The Generate subagent put `[data-slot]` on a wrapping
`<a>` AND on its inner `<h3>`/`<p>`/`<img>` children. The slot writer
runs the outer one first, sets `el.innerHTML = newValue` (just the
text from the DA cell), and obliterates the nested data-slot markers
before they get processed. 9 product cards rendered as bare labels.

**5.1.2 Media-Bus root-relative bug** (cost: ~120s diagnose + fix in
production round-trip). DA cell `<img>` values were root-relative
(`/assets/section-2/card-image-1.png`). EDS pipeline rewrote them all
to `<img src="about:error">` because Media Bus only resolves absolute
URLs.

Both are **rule-shaped**, not judgment-shaped. Both can be caught at
Generate time without an LLM:

**Proposed Generate-phase validator** (~30 LOC of mechanical
JavaScript) that the main agent runs after subagents finish:

```js
// For each [data-slot] element in template
for (const el of template.querySelectorAll('[data-slot]')) {
  const nested = el.querySelectorAll('[data-slot]');
  if (nested.length) console.error(
    `Container ${el.tagName}[data-slot="${el.dataset.slot}"] has `
    + `${nested.length} nested [data-slot] — slot writer will destroy them`);
}

// For each <img> in DA doc cells
for (const img of daDoc.querySelectorAll('div > div > img')) {
  const src = img.getAttribute('src');
  if (!/^https?:\/\//.test(src)) console.error(
    `DA cell img src is not absolute: ${src} — Media Bus needs absolute URLs`);
}
```

Either run synchronously from the main agent after subagents complete,
or build it into a `transform-da-to-eds` lint step. **Recommended for
run #006** — would have saved ~270s in run #005 and is trivial to
write.

### 5.2 The unilateral-skip mistake

I decided to skip the production round-trip because the source URL was
on `127.0.0.1`. Reasoning: "production preview host can't reach
localhost, assets will all 404, page will be visually broken." That
reasoning was correct as far as it went — but the **conclusion
("skip the step")** was wrong:

- Skipping prod missed the Media-Bus URL discovery, which is a
  generic rule the methodology now encodes.
- It also missed validating the rest of the chain (DA push, code-bus
  serving, overlay engine on prod) — all of which work fine
  independently of where assets live.
- The "vendor /assets/ in the repo" alternative the user proposed took
  ~15 min to execute and turned the broken-on-prod scenario into a
  fully-green end-to-end deploy.

**Lesson written to auto-memory** as
`user_prefers_not_unilaterally_narrowing_scope.md`: when the agent
sees a reason to skip / mark blocked / design around, surface the
call to the user as a question. Don't decide solo.

## 6. Concrete recommendations for run #006+

In order of expected impact:

1. **Multi-subagent Generate.** Split mechanical extractions
   (header/footer/CSS/animations) from the template+DA agent.
   4-5 parallel Sonnet subagents. Saves ~4-6 minutes. (§3.3)

2. **Generate-phase post-validator.** Catch the wrap-link bug
   (nested `[data-slot]`) and the Media-Bus bug (non-absolute DA
   cell `<img>` URLs) before they hit round-trip. Saves ~4-5 minutes
   of triage. (§5.1)

3. **Production round-trip is the default**, not an option to skip.
   Methodology and auto-memory both now make this explicit. (§5.2)

4. **Cheaper Wire phase.** Haiku 4.5. Quality bar is just "files in
   place, lint passes." (§4)

5. **Spec-mode Analyze.** Produce a structured `decisions.json` or
   YAML artifact during Analyze that Generate subagents read directly,
   instead of re-parsing prose `notes.md`. Reduces LLM
   re-interpretation. Possibly 20-30% Generate token reduction.

6. **Diagnostic subagent for Round-trip failures.** When a screenshot
   reveals broken rendering, dispatch a focused Opus subagent with the
   symptom + relevant code snippets, instead of the main agent
   absorbing the diagnosis itself. (§4 "failure triage" row)

7. **Move boilerplate context to a Claude Code skill.** The user's
   stated end-state. Once the skill loads methodology/learnings/slot
   writer reference once per invocation, subagents don't each re-read
   the same files. Faster startup + lower tokens.

8. **Pre-extract source artifacts during Analyze.** Split the 2687-
   line source into:
   - `head-links.txt` — head-level `<link>` tags to lift
   - `inline-style.css` — extracted inline `<style>` block
   - `inline-script.js` — extracted inline `<script>` blocks
   - `body-sections.html` — just the `<body>` content
   - `assets.json` — list of all referenced asset URLs

   Each Generate subagent reads only what it needs. ~30-50% Generate
   token reduction.

## 7. Net assessment

Run #005 was the project's most demanding source to date and produced
the highest yield in cross-project learnings (5 new entries in global
learnings, 2 substrate-relevant validators identified, 1 user-feedback
memory). Local + production round-trip both green; DA editing flowing.

Total active agent time: ~60 min (initial 30 + follow-up 30).
Equivalent run #006 with the recommendations above could land in
~25-30 minutes including production round-trip.

Branch awaits user direction to close.
