/**
 * variant-picker — displays 3 Stardust redesign variants as interactive iframe cards
 *
 * Reads runId from ?runId= URL param. Dispatches freehold:variant-selected when
 * the user clicks a card, which the eds-deploy-bar block listens for.
 *
 * Authoring rows (optional):
 *   1. Section headline
 *   2. Section subtext
 *
 * Page metadata required:
 *   freehold-api | https://app.freehold.dev
 */

const VARIANT_LABELS = ['', 'A — Safe', 'B — Motivator', 'C — Visionary'];

function apiBase() {
  return document.querySelector('meta[name="freehold-api"]')?.content
    ?? 'https://app.freehold.dev';
}

function buildPaletteChips(palette) {
  const row = document.createElement('div');
  row.className = 'variant-picker__palette';
  row.setAttribute('aria-label', 'Color palette');
  (palette ?? []).slice(0, 5).forEach((color) => {
    const chip = document.createElement('span');
    chip.className = 'variant-picker__chip';
    chip.style.backgroundColor = color;
    chip.setAttribute('aria-hidden', 'true');
    row.append(chip);
  });
  return row;
}

function buildCard(variant, onSelect) {
  const card = document.createElement('article');
  card.className = 'variant-picker__card';
  card.setAttribute('role', 'radio');
  card.setAttribute('aria-checked', 'false');
  card.setAttribute('aria-label', `Variant ${VARIANT_LABELS[variant.index] ?? variant.index}: ${variant.name}`);
  card.tabIndex = 0;

  // Preview iframe — sandboxed, no scripts
  const iframeWrap = document.createElement('div');
  iframeWrap.className = 'variant-picker__preview';

  const iframe = document.createElement('iframe');
  iframe.title = `Variant ${variant.index} preview`;
  iframe.setAttribute('sandbox', ''); // empty sandbox — srcdoc gets opaque null origin, no parent DOM access
  iframe.setAttribute('aria-hidden', 'true');
  iframe.srcdoc = variant.html;
  iframeWrap.append(iframe);

  // Card body
  const body = document.createElement('div');
  body.className = 'variant-picker__body';

  const tag = document.createElement('span');
  tag.className = 'variant-picker__tag';
  tag.textContent = VARIANT_LABELS[variant.index] ?? `Variant ${variant.index}`;

  const name = document.createElement('h3');
  name.className = 'variant-picker__name';
  name.textContent = variant.name;

  const palette = buildPaletteChips(variant.palette);

  const toggle = document.createElement('button');
  toggle.className = 'variant-picker__rationale-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = '▸ Why this direction';

  const rationale = document.createElement('p');
  rationale.className = 'variant-picker__rationale';
  rationale.hidden = true;
  rationale.textContent = variant.rationale;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.textContent = open ? '▸ Why this direction' : '▾ Hide rationale';
    rationale.hidden = open;
  });

  body.append(tag, name, palette, toggle, rationale);
  card.append(iframeWrap, body);

  // Selection
  function select() {
    onSelect(variant.index, variant.html, card);
  }

  card.addEventListener('click', select);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  });

  return card;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const headlineOverride = rows[0]?.firstElementChild?.textContent.trim();
  const subtextOverride = rows[1]?.firstElementChild?.textContent.trim();

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');

  if (!runId) {
    const err = document.createElement('p');
    err.className = 'variant-picker__error';
    err.textContent = 'No pipeline run found.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Start over →';
    block.replaceChildren(err, link);
    return;
  }

  // ── Loading state ──────────────────────────────────────────────────────

  const loadingEl = document.createElement('p');
  loadingEl.className = 'variant-picker__loading';
  loadingEl.textContent = 'Loading your redesigns…';
  block.replaceChildren(loadingEl);

  // ── Fetch run data ─────────────────────────────────────────────────────

  let run;
  try {
    const res = await fetch(`${apiBase()}/api/pipeline/${encodeURIComponent(runId)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    run = await res.json();
  } catch {
    const err = document.createElement('p');
    err.className = 'variant-picker__error';
    err.setAttribute('role', 'alert');
    err.textContent = 'Failed to load variants. Please try again.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Start over →';
    block.replaceChildren(err, link);
    return;
  }

  if (!run.variants?.length) {
    const err = document.createElement('p');
    err.className = 'variant-picker__error';
    err.textContent = 'No variants found. The pipeline may still be running.';
    block.replaceChildren(err);
    return;
  }

  // ── Build grid ─────────────────────────────────────────────────────────

  const header = document.createElement('div');
  header.className = 'variant-picker__header';

  const headline = document.createElement('h2');
  headline.className = 'variant-picker__headline';
  headline.textContent = headlineOverride || 'Choose your redesign';

  const subtext = document.createElement('p');
  subtext.className = 'variant-picker__subtext';
  subtext.textContent = subtextOverride || 'Three directions, each with a different personality. All WCAG AA.';

  header.append(headline, subtext);

  const grid = document.createElement('div');
  grid.className = 'variant-picker__grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Redesign variants');

  let selectedIndex = null;
  let selectedHtml = null;
  let selectedCard = null;

  function onSelect(index, html, card) {
    // Deselect previous
    if (selectedCard) {
      selectedCard.setAttribute('aria-checked', 'false');
      selectedCard.classList.remove('variant-picker__card--selected');
    }

    if (selectedIndex === index) {
      // Toggle off
      selectedIndex = null;
      selectedHtml = null;
      selectedCard = null;
    } else {
      selectedIndex = index;
      selectedHtml = html;
      selectedCard = card;
      card.setAttribute('aria-checked', 'true');
      card.classList.add('variant-picker__card--selected');
    }

    // Notify eds-deploy-bar
    document.dispatchEvent(new CustomEvent('freehold:variant-selected', {
      detail: { variantIndex: selectedIndex, variantHtml: selectedHtml, runId },
    }));
  }

  run.variants.forEach((variant) => {
    grid.append(buildCard(variant, onSelect));
  });

  block.replaceChildren(header, grid);
}
