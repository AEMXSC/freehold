# 005 — BizPro Hub Prototype (Adobe Acrobat marketing page)

Fifth iteration. **First locally-hosted source** — significant downstream
implications for production round-trip.

## Source

- **URL:** `http://127.0.0.1:8080/acom-bespoke-pages/bizpro-hub-prototype/`
- **File:** `input/index.html` (2687 lines, 120 KB) — largest source to date.
- **External JS:** `assets/lenis.min.js` (17.4 KB) — Lenis smooth-scroll library.
- **External CSS:** `assets/lenis.min.css` (457 B) — Lenis styles.
- **Captured via** `curl` against local dev server (no auth).
- **Page intent:** Adobe Acrobat "BizPro Hub" — PDF & productivity marketing
  page. Built by hand from Figma designs, not by a generator.

## Generator profile differences from prior runs

- **First hand-coded source** (no Stardust, no Mobirise — straight from Figma).
- **No `<header>` tag** — uses `<div class="nav-wrap">` instead.
- **Hero is a `<div>`** (`<div class="hero-scroll">`), not a `<section>`.
- **Significant inline JS** (520 lines across two blocks) for scroll-driven
  animations, carousels, and Lenis smooth scroll.
- **Self-hosted fonts** (18 OTF files) — first time we've seen this.
- **Source is local-only** (`127.0.0.1:8080`) — production preview won't be
  able to reach asset URLs.

## Structural map

```
   1   <!DOCTYPE html><html lang="en">
   3   <head>  ← inline <style> 1319 lines + Lenis CSS link
1327   </head>
1328   <body>
1331   <div class="nav-wrap">                       ← header fragment
1364   <div class="hero-scroll">                    ← block: hero (wrap → <section>)
1415   <section class="stories">                    ← block: stories
1484   <section class="acrobat-feature">            ← block: acrobat-feature
1579   <section class="tutorial">                   ← block: tutorial
1683   <section class="solutions">                  ← block: solutions
1780   <section class="studio-banner">              ← block: studio-banner
1804   <section class="product-section">            ← block: product-section
1975   <section class="search-section">             ← block: search-section
1998   <footer class="footer">                      ← footer fragment
2145   </footer>
2148   <div class="grid-overlay"> + grid-toggle     ← STRIP (dev tools)
2162   <script> 508 lines                           ← /scripts/bizpro-hub-animations.js
2673   <script src="assets/lenis.min.js">           ← /scripts/bizpro-hub-lenis.min.js
2674   <script> Lenis init (12 lines)               ← bundled into animations.js
2686   </body></html>
```

## Conversion contract

Template name: **`bizpro-hub`**.

- **Header** = `<div class="nav-wrap">` → `/fragments/bizpro-hub/header.html`
  (note: no `<header>` tag in source; treat the nav wrapper as the header)
- **Footer** = `<footer class="footer">` → `/fragments/bizpro-hub/footer.html`
- **Template** = synthesized `<main>` wrapping 8 sections (hero rewrapped
  to `<section>`), `<link rel=stylesheet>` for Lenis CSS at top of template
  → `/templates/bizpro-hub.html`
- **Page CSS** = inline `<style>` extracted → `/styles/bizpro-hub.css`
- **Lenis CSS** = vendored → `/styles/bizpro-hub-lenis.min.css`
- **Page JS** = inline `<script>` extracted + Lenis loader →
  `/scripts/bizpro-hub-animations.js`
- **Lenis JS** = vendored → `/scripts/bizpro-hub-lenis.min.js`
- **DA document** = divs-with-class body fragment with metadata block in
  main. Uploaded to `/sf-overlay-exp-005/home.html`.

## Status

**Closed 2026-05-19 (tag `iter-005-close`).**

- Production URL (frozen against `sf-overlay-exp-005`):
  `https://sf-overlay-exp-005--snowflake--aemcoder.aem.page/sf-overlay-exp-005/home`
- DA editor: `https://da.live/edit#/aemcoder/snowflake/sf-overlay-exp-005/home`

### Cross-project knowledge promoted from this run

- Container-vs-children slot rule: don't put `[data-slot]` on an
  element with nested `[data-slot]` children — the writer overwrites
  innerHTML and destroys nested markers.
- Hero (or any logical section) may be a `<div>`, not `<section>`:
  rewrite the outermost element to `<section>` in the template so the
  engine can match it.
- Cross-origin `@font-face` is CORS-restricted (other asset types
  aren't). Self-hosted fonts on a different origin from the served
  page need `Access-Control-Allow-Origin` headers.
- For scroll-animated pages, `fullPage:true` screenshots are
  misleading — capture per-section viewport screenshots instead.
- Locally-hosted source pages need an asset story (vendor / DA media
  / skip prod). Vendoring `/assets/` in the repo proven viable in
  this run.
- Media Bus needs ABSOLUTE URLs in DA cells; root-relative paths get
  rewritten to `about:error`. Asymmetry: template/fragment refs can
  stay root-relative (browser resolves), DA cell refs need absolute.
- AEM CLI dev server 404s on URL-encoded `%20` — avoid spaces in
  vendored asset directory names.
- Don't unilaterally narrow scope (skip phases, mark blocked, design
  around) without asking the user first.

See `notes.md` for the full phase log and
`timing-and-orchestration-report.md` for the timing breakdown,
parallelization analysis, and model-choice recommendations.
