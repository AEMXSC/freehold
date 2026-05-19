# Learnings — 005 BizPro Hub Prototype

Per-project findings. Cross-project items get promoted to
`experiments/knowledge/learnings.md` and are noted with **[promoted]**.

---

## 2026-05-19 — Wrapping link with nested data-slot children destroys content [promoted]

**Context.** Subagent slotted the 9 product cards' wrapping
`<a class="explore-card-link-container">` with `data-slot="card-N.link"`,
while ALSO slotting the inner icon `<img data-slot="card-N.icon">`,
title `<h3 data-slot="card-N.title">`, and body `<p data-slot="card-N.body">`.

The slot writer for `<a>` does `el.innerHTML = a.innerHTML` (with `a`
being the `<a>` element parsed from the DA cell value). DA cell value
was `<a href="#">Firefly</a>` → innerHTML became the text "Firefly",
wiping out icon + title + body before their data-slot markers could be
processed.

**Visible symptom:** the 9 product cards in `product-section` each
displayed only their card name as a dark text label; icons and bodies
gone, backgrounds invisible.

**Fix applied to this project.** Dropped the 9 `data-slot="card-N.link"`
attributes from the template and the 9 corresponding rows from the DA
doc. The `<a href="#">` stays as a structural wrapper, not authorable.
Inner title/body/icon/background slots all worked correctly afterwards.

**Generic rule.** Don't put `[data-slot]` on an element that has nested
`[data-slot]` children. The slot writer for ALL element types
(`<a>`, `<picture>`, default text) overwrites `innerHTML` and would
destroy nested markers — `<a>` is just the most common offender
because wrapping links are a common card pattern. Slot either the
container OR its inner children, never both.

## 2026-05-19 — Cross-origin font CORS restriction [promoted]

**Context.** Source page self-hosts 18 OTF font files at
`http://127.0.0.1:8080/.../assets/fonts/...`. The page CSS has
`@font-face { src: url('...') }` rules. Loading the converted page
from `http://localhost:3000/` triggered 6 console errors per page-load,
all for fonts:

> Access to font at 'http://127.0.0.1:8080/.../AdobeClean-Regular.otf'
> from origin 'http://localhost:3000' has been blocked by CORS policy:
> No 'Access-Control-Allow-Origin' header is present on the requested
> resource.

**Why fonts specifically.** Browsers enforce CORS preflight on font
fetches (per CSS Fonts spec). `<img>`, `<script src>`, `<source src>`,
CSS `url(image.jpg)` — all of these can load cross-origin without
CORS headers. But `@font-face url(font.otf)` cannot.

**Mitigation in this run.** Accepted. Fonts fall back to system-ui;
visual difference is subtle for the Adobe Clean family.

**For future locally-hosted-source runs.** The user's static-server
config would need `Access-Control-Allow-Origin: *` headers on font
responses, OR the fonts would need to be copied/migrated.

## 2026-05-19 — Local-only source breaks production round-trip [promoted]

**Context.** Source URL was `http://127.0.0.1:8080/...` — only reachable
from this dev machine. We rewrote ~73 relative asset paths to absolute
URLs pointing back at the localhost source per the methodology
rule. Local round-trip worked end-to-end. Production preview was
**not attempted** because:

- Production preview host is a public AEM aem.page instance.
- It cannot reach `http://127.0.0.1:8080`.
- All 60+ images, fonts, Lenis lib, etc. would 404.
- The overlay engine + DA content would technically work, but the
  rendered page would be visually broken.

**Three forward paths** (escalate to user):
1. Skip production round-trip when source is local-only (document, move on).
2. Add an "asset migration" helper to DA `/media/` so locally-hosted
   assets get uploaded once and referenced via DA's CDN.
3. Ask the user to publicly host the source page (e.g., GitHub Pages,
   Netlify) and re-run conversion.

## 2026-05-19 — Scroll-driven hero made `fullPage` screenshots misleading

**Context.** Source page uses a `position: sticky` hero (`.hero-sticky`
inside `.hero-scroll`) that occupies ~3 viewport heights of scroll-room.
A `fullPage: true` Playwright screenshot captures the page as if all
scroll-positions were rendered simultaneously, but the JS scroll
animations (parallax, IntersectionObserver `.anim-enter` fade-ins)
only paint to "final state" when actually scrolled. The first attempt
to read overall layout via fullpage screenshot showed huge black bands
between sections because:

- `.anim-enter` elements were `opacity:0` (initial state).
- `position: sticky` hero left empty scroll-room above content.

**What worked.** Scrolling each section into the viewport individually
with `element.scrollIntoView({block:'start'})` + a 400-800ms settle,
then taking viewport screenshots. Each section then rendered fully.

**Generalizable observation.** For scroll-animated pages, prefer
per-section viewport screenshots over `fullPage: true` in the
Round-trip phase. Save these to `diff/` with section names.

## 2026-05-19 — Header-less source page (no `<header>` tag)

**Context.** Source used `<div class="nav-wrap"><nav class="nav">…`
instead of `<header>`. The conversion contract still names this the
"header fragment" (`/fragments/<tpl>/header.html`). The boilerplate
`blocks/header/header.js` injects whatever fragment it fetches into
the `<header>` element on the EDS-decorated page — and that works
fine because EDS adds `<header>` itself regardless of source markup.

**Takeaway.** "Header fragment" is a contract name, not a tag-name
requirement. Same logic for footer (this source used `<footer>` but
either way works).

## 2026-05-19 — Hero is a `<div>`, not `<section>` — must wrap

**Context.** Source's hero was `<div class="hero-scroll">`. The overlay
engine matches blocks via `template.querySelectorAll('section[class]')`,
so a `<div>`-wrapped hero would never get its slots applied. Fix: in
the generated template, rewrite the outermost element from `<div>` to
`<section class="hero hero-scroll">`. The inner DOM (including the
`hero-scroll` class) stays — only the tag name changes.

**Generic rule.** When the source's logical sections aren't `<section>`
tags (most common for hero), the Generate phase MUST rewrite the
outermost element to `<section>` so the engine can find it. The
methodology already covers synthesizing `<main>`; this is the parallel
rule for non-`<section>` blocks. (Worth promoting if a future source
hits the same pattern.)

## 2026-05-19 — Inline `<script>` extraction + library loader pattern

**Context.** Source had 520 lines of inline JS across two blocks plus
an external library (Lenis smooth-scroll, 17.4 KB). Solution:

1. Vendor the external library to `/scripts/<tpl>-lenis.min.js`.
2. Write a single `/scripts/<tpl>-animations.js` that:
   - Loads the library by injecting `<script src="…lenis.min.js">`.
   - Runs the original animations in the `onload` callback.
3. The boilerplate `delayed.js` HEAD-probes
   `/scripts/<tpl>-animations.js` and loads it after the eager phase.

Works for any source page with the "external lib + inline init" shape.
Lenis-specific quirks (UMD vs ESM, global namespace) were handled by
keeping the lib as a `<script>` tag — no module loader needed.

## 2026-05-19 — Dev-tool markup in source (grid-overlay)

**Context.** Source had a designer grid-overlay control between
`</footer>` and `</body>` — a `<div class="grid-overlay">` + a
`<button class="grid-toggle" onclick="toggleGrid()">`. These are
clearly designer aids, not page content.

**Handling.** Stripped them from the template. The associated
`toggleGrid` JS function in the animations script was harmless to
leave in place — its references to `gridOverlay` element resolve to
null with no crash. Left it for now, but a future cleanup pass could
strip those JS references too.

## 2026-05-19 — `<br>` line breaks lost when DA-authored (confirmed run #004 finding)

**Context.** Source uses `<br>` in 14 places for visual line breaks
inside titles (story-card titles, tutorial slide headlines, footer
column titles). Per the pipeline's strip list, `<br>` is dropped from
DA cell values.

**Visible effect.** Looking at the rendered DOM:
- Template default: `Volvo Cars drives modern service<br>through Adobe Acrobat Sign.`
- DA-authored value: `Volvo Cars drives modern service through Adobe Acrobat Sign.`
- Rendered title: the second form (no line break, wraps naturally on the line).

For authors who care about specific line breaks, the workaround is to
restructure into two `<p>` tags (two text slots). For this run we
accepted the visual difference — it's subtle and doesn't break layout.

## 2026-05-19 — Adobe Express button in tutorial section is non-authorable

**Context.** Tutorial section has a `<button class="tutorial__play">`
inside each slide — these are decorative play icons, not authorable.
Subagent correctly left them as static template elements with their
`<img>` icon hardcoded.
