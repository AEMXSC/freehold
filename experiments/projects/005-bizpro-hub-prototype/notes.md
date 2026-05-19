# Notes — 005 BizPro Hub Prototype

---

## Phase: Capture

- **Source URL:** `http://127.0.0.1:8080/acom-bespoke-pages/bizpro-hub-prototype/`
  (LOCAL-ONLY host — only reachable from this dev machine).
- **HTML size:** 2687 lines, 120 KB. Largest source we've handled.
- **External assets:**
  - `assets/lenis.min.css` (1 line, 457 B) — saved as `input/lenis.min.css`
  - `assets/lenis.min.js` (1 line, 17.4 KB) — saved as `input/lenis.min.js`
- **Inline assets:**
  - One inline `<style>` (lines 8–1326, 1319 lines)
  - One inline `<script>` (lines 2162–2670, 508 lines of scroll/carousel/animation JS)
  - One inline Lenis init `<script>` (lines 2674–2685)
- **Capture method:** `curl -s` against localhost; no auth.
- **Page intent:** Adobe Acrobat "BizPro Hub" marketing prototype, Figma-derived
  hand-coded HTML (NOT Stardust). 8 content sections + nav + footer.

## Phase: Analyze

### Structural map

```
Line     Element
─────    ─────────────────────────────────────────────────────────────
   1     <!DOCTYPE html>
   3     <head>
         ├─ <meta>, <title>
         ├─ <link rel="stylesheet" href="assets/lenis.min.css">
         └─ <style> (1319 lines)
1327     </head>
1328     <body>
         ↳ NO <header> tag — nav is plain <div>
1331     <div class="nav-wrap"><nav class="nav">     ← header fragment
1361     </nav></div>
         ↳ NO <main>
1364     <div class="hero-scroll">                   ← block: hero (needs wrap → <section>)
1411     </div>
1415     <section class="stories">                   ← block: stories (4 cards w/ bg-img)
1480     </section>
1484     <section class="acrobat-feature">           ← block: acrobat-feature
1573     </section>
1578     <div class="tutorial-scroll">
1579     <section class="tutorial">                  ← block: tutorial (carousel)
1673     </section>
1674     </div>
1683     <section class="solutions">                 ← block: solutions (3 price cards)
1777     </section>
1780     <section class="studio-banner">             ← block: studio-banner
1801     </section>
1804     <section class="product-section">           ← block: product-section (9 tiles)
1972     </section>
1975     <section class="search-section">            ← block: search-section
1995     </section>
1998     <footer class="footer">                     ← footer fragment
2145     </footer>
         ↳ Post-footer dev tools (strip):
2148     <div class="grid-overlay">
2156     <button class="grid-toggle">
2162     <script>  (508 lines of animations)
2673     <script src="assets/lenis.min.js"></script>
2674     <script>  (Lenis init, 12 lines)
2686     </body>
```

### Distinguishing features (vs. prior runs)

| Aspect | This run (#005) | Run #004 Heathrow |
|---|---|---|
| Generator | Hand-coded / Figma-derived | Stardust |
| `data-section` attrs | No | No |
| Placeholder convention | None (clean) | None |
| Inline `<style>` | Yes (1319 lines) | No (external CSS file) |
| Inline `<script>` | Yes (520 lines total) | No |
| External JS lib | `lenis.min.js` smooth scroll | None |
| `<header>` tag | **Absent** — `<div class="nav-wrap">` instead | Present |
| `<main>` tag | Absent (sections at body level) | Absent |
| Hero element | `<div class="hero-scroll">` — **not a `<section>`** | `<section class="hero">` |
| Section first-class collisions | None | Two `class="section"` |
| Source host | `http://127.0.0.1:8080` (**local only**) | GitHub Pages (public) |
| Self-hosted fonts | 18 OTF files | Google Fonts CDN |
| Background-image slots | 4 (story cards) | 6 (pillar cards) |
| `<br>` tags | 14 (heavy use in titles) | 4 (per-phase headings) |
| Section count | 8 (incl. hero) | 4 |

### Decisions surfaced by analysis

1. **Synthesize `<main>`** wrapping all 8 content sections (hero + 7 named).
   Engine requires `<main>` to drive overlay.

2. **Hero is a `<div>` — rewrite to `<section class="hero hero-scroll">`.**
   The overlay engine selects `section[class]` to match block names. A `<div>`
   won't match. Source CSS rules using `.hero-scroll` keep working because
   we keep the class.

3. **Tutorial wrapper:** `<div class="tutorial-scroll">` wraps
   `<section class="tutorial">`. The inner `<section>` is what the engine
   matches — leave the wrapper div in the template (CSS depends on it).

4. **Dev tools to strip from template:** the `<div class="grid-overlay">`
   and `<button class="grid-toggle">` blocks (lines 2148–2161). They're
   designer/dev aids, not page content. Their JS (toggleGrid) goes too.

5. **Inline scripts → `/scripts/bizpro-hub-animations.js`.** Two blocks:
   the 508-line animations + the 12-line Lenis init. Concatenate them
   into one file. The engine HEAD-probes this path before loading; if
   it 404s, no harm.

6. **Lenis library** is loaded from `assets/lenis.min.js` in the source.
   Two options:
   - (chosen) Copy `lenis.min.js` to `/scripts/bizpro-hub-lenis.min.js`.
     Have the animations engine load it via `<script>` injection
     before its own init runs. The boilerplate `delayed.js` HEAD-probes
     the per-template animations file and loads it; Lenis can be loaded
     by that same animations file at startup.
   - (rejected) Rewrite to a public CDN — risky, the user already
     hand-vendored this file and it's tiny (17 KB).

   Similarly: `lenis.min.css` (457 B) — copy to
   `/styles/bizpro-hub-lenis.min.css`. The template needs to declare it
   as a `<link>` at the top, which the engine lifts to head.

7. **Relative asset paths (~73 references):** rewrite to absolute URLs
   pointing back to `http://127.0.0.1:8080/acom-bespoke-pages/bizpro-hub-prototype/`.

   **CRITICAL CAVEAT — local-only source:** unlike prior runs whose source
   hosts were public (GitHub Pages), `127.0.0.1:8080` is private to this
   machine. **Production round-trip will be broken**: asset URLs and the
   self-hosted font URLs all 404 from the production preview host. We
   accept this for run #005 — local round-trip is the primary goal.
   This is a generic finding worth promoting: **when source is local-only,
   production round-trip requires either asset migration to DA `/media/`
   or hosting source assets somewhere public.**

8. **Self-hosted fonts (18 OTFs):** the inline `<style>` declares
   `@font-face` with relative `assets/fonts/` paths. Rewrite to absolute
   localhost URLs (same caveat as #7).

9. **`<br>` is on the strip list** (run #004 learning). 14 `<br>` tags
   appear inside headings and titles. For text slots, the `<br>` is
   preserved in template defaults (renders correctly without DA edits)
   but if an author edits the slot via DA the `<br>` is dropped — they'd
   need to type two paragraphs. **Accept this trade-off**; document in
   per-project learnings.

10. **Slot strategy** — by section:

    | Block | Slot count (rough) | Notes |
    |---|---|---|
    | hero | ~5 text + 1 video | Video slot is NEW pattern — element type? |
    | stories | 3 header text + 4×(category, title, photo) = 15 | Background-image slot ×4 |
    | acrobat-feature | 3 hdr + 1 wide (img, title, body, cta) + 3 cards × (img, title, body, cta) | 19 |
    | tutorial | 3 slides × (image, eyebrow, headline) = 9 (clones NOT slotted, JS-generated) | 9 |
    | solutions | 2 hdr + 3 tabs + 3 cards × (name, price, billing, features×N, ctas) | ~25 |
    | studio-banner | 4 text + 3 picture × (img) | ~10 |
    | product-section | 9 cards × (icon, title, body, background) = 36 | High volume — repeating |
    | search-section | 4 text | 4 |
    | **Total** | ~115 slots | |

11. **Video element in hero (`<video><source src=…>`):** the source's hero
    has a looping background video. No existing slot writer handles
    `<video>` or `<source>`. Options:
    - (a) Leave video URL static in template (not authorable)
    - (b) Add a 6th slot writer case for `<video>`/`<source>` (substrate
      change). Probably yes if a future page needs it too — but for run
      #005, defer unless time permits. **Decision: leave static for now,
      promote as an open question.**

12. **Picture element with multiple `<source>` (studio-banner):** uses
    three `<picture>`s for mobile/tablet/desktop. Each has just an
    `<img>` inside (no `<source>` media-queries). Existing PICTURE slot
    writer handles this case fine.

### Open question for the Reflect phase

- **Local-only source caveat:** the production-round-trip blocker for
  locally-hosted sources may motivate methodology evolution (e.g., a
  "local-only mode" that skips production push, or an asset migration
  helper to DA `/media/`).

## Phase: Generate

Delegated to subagent (general-purpose) with full methodology + this
project's notes + scripts.js context. Produced (in `output/`):

- `templates/bizpro-hub.html` (33.9 KB) — 122 `[data-slot]` markers,
  8 unique-first-class sections in synthesized `<main>`, top-level
  `<link rel=stylesheet>` for Lenis CSS.
- `fragments/bizpro-hub/header.html` (1.3 KB) — nav-wrap content.
- `fragments/bizpro-hub/footer.html` (7.0 KB) — full footer.
- `styles/bizpro-hub.css` (51.6 KB) — inline `<style>` extracted, all
  `url(…)` rewritten to absolute localhost.
- `styles/bizpro-hub-lenis.min.css` (457 B) — verbatim copy.
- `scripts/bizpro-hub-animations.js` (26.3 KB) — Lenis loader prelude
  injecting the Lenis `<script>` then running source's 508 lines of
  animations + Lenis init inside `main()` callback.
- `scripts/bizpro-hub-lenis.min.js` (17.4 KB) — verbatim copy.
- `da/home.html` (15.7 KB) — 9 div.class blocks (8 content + 1
  metadata), 124 rows (122 slot + 2 metadata).

Notable judgment calls from the subagent:
1. Hero `<video><source>` left static (URL absolute, src not slotted)
   — no slot writer for `<video>`. Open question carried forward.
2. Pricing-card feature `<ul>` lists (15 items across 3 cards) left
   static — whole-list slotting not supported yet.
3. `switchTab` (referenced by inline `onclick=`) exposed via
   `window.switchTab = switchTab` inside `main()` so the click handlers
   still resolve after the function-scoping change.
4. Studio-banner: only the desktop `<picture>` got a slot; mobile/tablet
   `<picture>`s mirror the same URL as static fallbacks.

## Phase: Wire

Standard copy-to-deployed-paths (7 files) + `transform-da-to-eds.mjs`
to produce `drafts/bizpro-hub-home.html`. `npm run lint` clean.

## Phase: Round-trip

### Local

- `aem up --html-folder drafts --no-open --forward-browser-logs`
- Loaded `http://localhost:3000/drafts/bizpro-hub-home.html` in Playwright.
- **`main.dataset.overlay === "bizpro-hub"`** ✓
- **8 sections** present (`hero, stories, acrobat-feature, tutorial,
  solutions, studio-banner, product-section, search-section`) ✓
- Header (nav-wrap) + footer (Adobe corporate) both visible ✓
- Lenis loaded (`window.Lenis` defined) ✓
- 4 story-card background-image slots set with absolute URLs ✓
- Hero `<video>` `<source>` URL absolute (static, not authored) ✓

**Bug surfaced + fixed in this phase:** subagent slotted the wrapping
`<a class="explore-card-link-container">` in product-section with
`data-slot="card-N.link"` (9 cards). The link slot writer does
`el.innerHTML = a.innerHTML` — wiping out the nested icon
(`<p><img>`), title (`<h3 data-slot=…>`), and body (`<p data-slot=…>`)
slots. Visual symptom: 9 cards reduced to a single text label each.
Fix: dropped the 9 `card-N.link` attributes from the template AND
the 9 `card-N.link` rows from the DA doc. Kept the inner title/body/icon
slots which work correctly. The link's `href="#"` is now structural
(static).

**Generic finding promoted:** "Don't slot an element that has nested
`[data-slot]` children." The slot writer (for any element type, not
just links) replaces innerHTML, destroying nested slot markers before
they can be processed.

### Console errors

6 errors, all the same shape: **CORS-blocked font requests** from
`http://127.0.0.1:8080`. Browsers enforce CORS strictly on `@font-face`
URLs (unlike `<img>`/`<script>`/`<source>` which are allowed). The
user's local dev server doesn't send `Access-Control-Allow-Origin`,
so fonts fall back to system-ui. Visually subtle (rendered text is
close to Adobe Clean Display).

**Generic finding promoted:** "Cross-origin `@font-face` requires the
asset host to send `Access-Control-Allow-Origin`; relevant for any
self-hosted-font source page on a different origin."

### Production

**Not performed** for this run. Rationale: source page is served from
`http://127.0.0.1:8080` (the user's local machine) — the production
preview host cannot reach those asset URLs. 60+ images, the Lenis lib,
and 18 self-hosted fonts would all 404 from production. Round-trip
would technically succeed (overlay engine works, structure intact)
but visually be a broken page. Skipped per the open-question policy:
escalate to user before committing to a "local-only mode" workflow.

## Phase: Reflect (open, awaiting user)

### Substrate improvements made during this run

**None to deployed code paths.** All findings landed in methodology/
learnings. The product-card link-slot bug was fixed at the template
+ DA-doc level, not at the engine level (the engine's behaviour is
correct as documented).

### Cross-project learnings promoted to `experiments/knowledge/learnings.md`

1. **Don't slot an element that has nested `[data-slot]` children.**
   The slot writer overwrites `innerHTML`, destroying nested markers.
   Symptom in run #005: 9 product cards reduced to a label each
   because the wrapping `<a>` was slotted.
2. **Cross-origin `@font-face` is CORS-restricted.** Other asset types
   (`<img>`, `<script src>`, `<source src>`) load fine cross-origin,
   but fonts require `Access-Control-Allow-Origin`. When the source
   page self-hosts fonts and the host doesn't add CORS headers,
   fonts fall back to system-ui.
3. **Locally-hosted source pages can't round-trip to production.**
   Assets on `http://127.0.0.1:*` are private to the dev machine.
   Three options for future locally-hosted sources: (a) skip prod
   round-trip, (b) migrate assets to DA `/media/` (out of current
   scope), or (c) ask the user to publicly host their static page.

### Project-specific learnings

In `learnings.md` in this folder.

### Open items

- ~~Production round-trip is blocked by the local-only source.~~
  **Resolved by vendoring assets to /assets/ in the repo (see follow-up phase below).**
- Hero `<video><source>` not authorable (no slot writer for `<video>`).
- Studio-banner mobile/tablet `<picture>` URLs aren't authorable
  (same URL as desktop is fine for this source, but a different
  responsive image set would need them slotted).
- Pricing-card `<ul>` feature lists are static (no repeating-list slot
  pattern yet).
- Per-card titles lose `<br>` line breaks when DA-authored (run #004
  finding, observed in tutorial slide headlines + story card titles
  in this run).

## Phase: Follow-up — vendor assets + production round-trip

After the user pushed back on my decision to skip production: vendored
the source's 72 asset files (38 MB) under `/assets/` in the repo so
code-bus serves them. Same paths work locally and on production.

Steps:
1. `cp -R /Users/catalan/repos/ai/acom-snowflake/acom-bespoke-pages/bizpro-hub-prototype/assets ./assets`
2. Removed 21 unreferenced files (loose SVGs, extra fonts, the already-
   vendored Lenis bundle, `.DS_Store`s).
3. Renamed `assets/fonts/Adobe Clean Display/` → `assets/fonts/AdobeCleanDisplay/`
   because the aem CLI 404s on URL-encoded `%20` in paths.
4. `sed` pass to rewrite `http://127.0.0.1:8080/acom-bespoke-pages/bizpro-hub-prototype/`
   → `/` in templates/, fragments/, styles/, output/da/.
5. Re-built drafts file, re-verified local round-trip — **0 console errors**
   (CORS-blocked font errors gone, same-origin).
6. Created branch `sf-overlay-exp-005` from `sf-overlay-exp`.
7. Committed 108 files (~38 MB), pushed to origin.
8. PUT updated DA doc to `admin.da.live/source/aemcoder/snowflake/sf-overlay-exp-005/home.html`
   → HTTP 200.
9. POST preview on `admin.hlx.page/preview/.../sf-overlay-exp-005/sf-overlay-exp-005/home`
   → HTTP 200.
10. Loaded production preview URL in Playwright.

### Bug surfaced + fixed during production round-trip

**Media Bus doesn't resolve root-relative URLs in DA cells.**
Initial PUT used `<img src="/assets/section-2/card-image-1.png">` in
DA cells. EDS pipeline served those as `<img src="about:error">` and
the story-card background-images came out as `url("about:error")`.

Cause: the pipeline's Media Bus only handles ABSOLUTE URLs. Root-
relative paths are resolved against the DA content host
(`content.da.live`), where these assets don't exist → fallback to
`about:error`.

**Fix:** in the DA doc, rewrote all 30 image URLs to absolute branch
URLs `https://sf-overlay-exp-005--snowflake--aemcoder.aem.page/assets/...`.
Re-PUT, re-preview. Media Bus then correctly fetched + optimised:
`<img src="./media_<sha>.png?width=750&format=webply&optimize=medium">`.

This split — root-relative for static template/fragment refs (browser
resolves), absolute for DA cell refs (Media Bus needs absolute) — is
a new methodology rule. Promoted to global learnings.

### Production round-trip verified

- `main.dataset.overlay === "bizpro-hub"` ✓
- 8 sections present (all unique-first-class) ✓
- 9 product cards rendering with icons, titles, bodies ✓
- 4 story-card photos rendering via Media Bus optimised paths ✓
- Adobe Clean / Adobe Clean Display fonts loading from /assets/fonts/ ✓
- Hero video URL absolute to branch host ✓
- 0 console errors ✓

Screenshots: `diff/production-stories.jpg`, `diff/production-product-grid.jpg`.

### Cross-project learnings promoted (additions from follow-up)

1. **Vendoring `/assets/` in the repo is a viable option for
   locally-hosted source pages.** Same paths work locally and on
   production via code-bus. Trade-off: binary assets in git
   (~38 MB for this run). Acceptable for one-off bespoke prototypes;
   long-term production pages should prefer DA media.
2. **Media Bus needs absolute URLs in DA cells.** Root-relative
   (`/assets/...`) gets rewritten to `about:error` because Media Bus
   resolves against the DA content host. Use absolute URLs in DA
   cells; static template/fragment refs can stay root-relative
   (browser resolves them against the page host = code-bus host).
3. **AEM CLI dev server 404s on URL-encoded `%20` in paths.** Avoid
   spaces in vendored asset directory names; rename to
   PascalCase / kebab-case before committing.

### Status

**Local + production round-trip both verified.** Branch
`sf-overlay-exp-005` deployed to
`https://sf-overlay-exp-005--snowflake--aemcoder.aem.page/sf-overlay-exp-005/home`.

## Phase: Close (2026-05-19)

Iteration closed by explicit user request after:
  - Local round-trip verified (0 console errors, all 8 sections
    rendering with DA-authored content).
  - Production round-trip verified end-to-end (overlay applied,
    Media-Bus optimised images, Adobe Clean fonts loaded, 0 console
    errors).
  - 38 MB of source assets vendored to `/assets/` and serving via
    code-bus on both localhost and production.
  - 7 cross-project learnings promoted to `experiments/knowledge/learnings.md`.
  - 2 methodology updates landed:
    - Container-vs-children slot rule + non-`<section>` block
      rewrite (Generate phase).
    - Media-Bus absolute-URL rule for DA cell `<img>` (Generate
      phase) + the vendor-`/assets/`-in-repo path for local-only
      sources (Round-trip phase).
  - 1 user-feedback memory added
    (`user_prefers_not_unilaterally_narrowing_scope.md`).

Branch `sf-overlay-exp-005` frozen at this commit. Tag
`iter-005-close` to follow.
