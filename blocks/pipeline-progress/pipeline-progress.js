/**
 * pipeline-progress — polls the Freehold pipeline and shows animated step list
 *
 * Reads runId from ?runId= URL param. Navigates to /variant-picker when complete.
 *
 * Authoring rows (all optional):
 *   1. Loading headline override
 *   2. Subtext override
 *
 * Page metadata required:
 *   freehold-api | https://app.freehold.dev
 */

const STEPS = [
  { key: 'audit',      label: 'Auditing your site' },
  { key: 'crawl',      label: 'Rendering in real browser' },
  { key: 'brand',      label: 'Capturing brand surface' },
  { key: 'extract',    label: 'Analyzing design system' },
  { key: 'validate',   label: 'Generating redesign variants' },
  { key: 'llm-output', label: 'Adding AI-legible output' },
];

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 80; // ~3.5 min before timeout error

function apiBase() {
  return document.querySelector('meta[name="freehold-api"]')?.content
    ?? 'https://app.freehold.dev';
}

function setStepState(listEl, currentKey, pct) {
  const stepIndex = STEPS.findIndex((s) => s.key === currentKey);
  [...listEl.children].forEach((li, i) => {
    const indicator = li.querySelector('.pipeline-progress__indicator');
    const labelEl = li.querySelector('.pipeline-progress__label');
    const spinnerEl = li.querySelector('.pipeline-progress__step-spin');

    if (i < stepIndex) {
      indicator.className = 'pipeline-progress__indicator pipeline-progress__indicator--done';
      indicator.textContent = '✓';
      indicator.setAttribute('aria-label', 'Done');
      labelEl.className = 'pipeline-progress__label pipeline-progress__label--done';
      spinnerEl.hidden = true;
    } else if (i === stepIndex) {
      indicator.className = 'pipeline-progress__indicator pipeline-progress__indicator--active';
      indicator.textContent = String(i + 1);
      labelEl.className = 'pipeline-progress__label pipeline-progress__label--active';
      spinnerEl.hidden = false;
    } else {
      indicator.className = 'pipeline-progress__indicator';
      indicator.textContent = String(i + 1);
      labelEl.className = 'pipeline-progress__label';
      spinnerEl.hidden = true;
    }
  });
}

export default async function decorate(block) {
  const rows = [...block.children];
  const headlineOverride = rows[0]?.firstElementChild?.textContent.trim();
  const subtextOverride = rows[1]?.firstElementChild?.textContent.trim();

  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');

  if (!runId) {
    const err = document.createElement('p');
    err.className = 'pipeline-progress__error';
    err.textContent = 'No pipeline run found. Please start over.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Start over →';
    block.replaceChildren(err, link);
    return;
  }

  // ── Build DOM ──────────────────────────────────────────────────────────

  const headline = document.createElement('h2');
  headline.className = 'pipeline-progress__headline';
  headline.textContent = headlineOverride || 'Analyzing your site…';

  const subtext = document.createElement('p');
  subtext.className = 'pipeline-progress__subtext';
  subtext.textContent = subtextOverride || 'Usually takes 1–3 minutes';

  const barTrack = document.createElement('div');
  barTrack.className = 'pipeline-progress__bar-track';
  barTrack.setAttribute('role', 'progressbar');
  barTrack.setAttribute('aria-valuemin', '0');
  barTrack.setAttribute('aria-valuemax', '100');
  barTrack.setAttribute('aria-valuenow', '0');

  const barFill = document.createElement('div');
  barFill.className = 'pipeline-progress__bar-fill';
  barTrack.append(barFill);

  const list = document.createElement('ol');
  list.className = 'pipeline-progress__steps';
  list.setAttribute('aria-label', 'Pipeline steps');

  STEPS.forEach((step, i) => {
    const li = document.createElement('li');
    li.className = 'pipeline-progress__step';

    const indicator = document.createElement('div');
    indicator.className = 'pipeline-progress__indicator';
    indicator.textContent = String(i + 1);
    indicator.setAttribute('aria-hidden', 'true');

    const labelEl = document.createElement('span');
    labelEl.className = 'pipeline-progress__label';
    labelEl.textContent = step.label;

    const spinnerEl = document.createElement('span');
    spinnerEl.className = 'pipeline-progress__step-spin';
    spinnerEl.setAttribute('aria-hidden', 'true');
    spinnerEl.hidden = true;

    li.append(indicator, labelEl, spinnerEl);
    list.append(li);
  });

  const errorEl = document.createElement('p');
  errorEl.className = 'pipeline-progress__error';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;

  block.replaceChildren(headline, subtext, barTrack, list, errorEl);

  // ── Poll ────────────────────────────────────────────────────────────────

  let polls = 0;
  let stopped = false;
  window.addEventListener('pagehide', () => { stopped = true; }, { once: true });

  async function poll() {
    while (!stopped) {
      if (polls >= MAX_POLLS) {
        errorEl.textContent = 'This is taking longer than expected. Please try again.';
        errorEl.hidden = false;
        return;
      }
      polls++;

      try {
        const res = await fetch(`${apiBase()}/api/pipeline/${encodeURIComponent(runId)}`, {
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          if (res.status === 404) {
            errorEl.textContent = 'Pipeline run not found. Please start over.';
            errorEl.hidden = false;
            return;
          }
          // transient error — keep retrying
        } else {
          const run = await res.json();

          // Update headline with live message
          if (run.progress?.message) headline.textContent = run.progress.message;

          // Update progress bar
          const pct = run.progress?.pct ?? 0;
          barFill.style.width = `${pct}%`;
          barTrack.setAttribute('aria-valuenow', String(pct));

          // Update step indicators
          if (run.progress?.step) setStepState(list, run.progress.step, pct);

          if (run.status === 'complete') {
            if (!stopped) window.location.href = `/variant-picker?runId=${encodeURIComponent(runId)}`;
            return;
          }

          if (run.status === 'failed') {
            const link = document.createElement('a');
            link.href = '/';
            link.textContent = 'Try a different URL →';
            errorEl.textContent = 'Pipeline failed — the URL may be unreachable or behind a login. ';
            errorEl.append(link);
            errorEl.hidden = false;
            return;
          }
        }
      } catch {
        // Network error — retry silently
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  poll();
}
