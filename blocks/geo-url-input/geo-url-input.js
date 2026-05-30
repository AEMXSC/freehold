/**
 * geo-url-input — URL capture form that starts the Freehold GEO pipeline
 *
 * Authoring rows (positional):
 *   1. Headline text
 *   2. Description / subtext
 *   3. Button label (optional, defaults to "Get my GEO score")
 *
 * Page metadata required:
 *   freehold-api | https://app.freehold.dev   (pipeline API base URL)
 */

function apiBase() {
  return document.querySelector('meta[name="freehold-api"]')?.content
    ?? 'https://app.freehold.dev';
}

function text(cell) {
  return cell ? cell.textContent.trim() : '';
}

function setLoading(btn, label, loading) {
  btn.disabled = loading;
  btn.querySelector('.geo-url-input__spinner').hidden = !loading;
  btn.querySelector('.geo-url-input__btn-label').textContent = loading ? 'Analyzing…' : label;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const headline = text(rows[0]?.firstElementChild);
  const description = text(rows[1]?.firstElementChild);
  const btnLabel = text(rows[2]?.firstElementChild) || 'Get my GEO score';

  // ── Build DOM ──────────────────────────────────────────────────────────

  const heading = document.createElement('h2');
  heading.className = 'geo-url-input__headline';
  heading.textContent = headline || 'Is your site invisible to AI?';

  const desc = document.createElement('p');
  desc.className = 'geo-url-input__desc';
  desc.textContent = description || 'Get your GEO readiness score in 30 seconds.';

  const form = document.createElement('form');
  form.className = 'geo-url-input__form';
  form.noValidate = true;

  const input = document.createElement('input');
  input.className = 'geo-url-input__field';
  input.type = 'url';
  input.placeholder = 'https://yourbusiness.com';
  input.autocomplete = 'url';
  input.required = true;
  input.setAttribute('aria-label', 'Website URL');
  input.setAttribute('aria-describedby', 'geo-url-input-error');

  const spinner = document.createElement('span');
  spinner.className = 'geo-url-input__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinner.hidden = true;

  const btnLabelSpan = document.createElement('span');
  btnLabelSpan.className = 'geo-url-input__btn-label';
  btnLabelSpan.textContent = btnLabel;

  const btn = document.createElement('button');
  btn.className = 'geo-url-input__btn';
  btn.type = 'submit';
  btn.append(spinner, btnLabelSpan);

  const row = document.createElement('div');
  row.className = 'geo-url-input__row';
  row.append(input, btn);

  const error = document.createElement('p');
  error.className = 'geo-url-input__error';
  error.id = 'geo-url-input-error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  form.append(row, error);

  // ── Prefill from ?url= query param ────────────────────────────────────

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get('url');
  if (prefill) input.value = prefill;

  // ── Submit handler ─────────────────────────────────────────────────────

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = input.value.trim();
    if (!url) return;

    // Basic URL validation before hitting the API
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      error.textContent = 'Please enter a valid URL starting with https://';
      error.hidden = false;
      input.focus();
      return;
    }

    error.hidden = true;
    setLoading(btn, btnLabel, true);

    try {
      const res = await fetch(`${apiBase()}/api/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not start analysis. Please try again.');
      }

      const { runId } = await res.json();
      if (!runId) throw new Error('Unexpected response from server.');

      window.location.href = `/pipeline-progress?runId=${encodeURIComponent(runId)}`;
    } catch (ex) {
      error.textContent = ex instanceof Error ? ex.message : 'Something went wrong. Please try again.';
      error.hidden = false;
      setLoading(btn, btnLabel, false);
      input.focus();
    }
  });

  block.replaceChildren(heading, desc, form);
}
