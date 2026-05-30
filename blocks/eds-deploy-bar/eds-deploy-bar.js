/**
 * eds-deploy-bar — sticky deploy bar that listens for variant selection
 *
 * Listens to freehold:variant-selected from variant-picker block.
 * On deploy: calls POST /api/deploy, then navigates to /eds-deploying.
 *
 * Authoring rows (optional):
 *   1. Deploy button label
 *   2. Selected label prefix (e.g. "Variant")
 *
 * Page metadata required:
 *   freehold-api | https://app.freehold.dev
 */

function apiBase() {
  return document.querySelector('meta[name="freehold-api"]')?.content
    ?? 'https://app.freehold.dev';
}

export default async function decorate(block) {
  const rows = [...block.children];
  const btnLabelDefault = rows[0]?.firstElementChild?.textContent.trim() || 'Deploy to AEM EDS →';
  const selectedPrefix = rows[1]?.firstElementChild?.textContent.trim() || 'Variant';

  // ── Build bar ──────────────────────────────────────────────────────────

  const bar = document.createElement('div');
  bar.className = 'eds-deploy-bar__bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Deploy selected variant');
  bar.setAttribute('aria-hidden', 'true'); // hidden until a variant is selected

  const info = document.createElement('div');
  info.className = 'eds-deploy-bar__info';

  const variantLabel = document.createElement('p');
  variantLabel.className = 'eds-deploy-bar__variant-label';
  variantLabel.textContent = 'No variant selected';

  const deployTo = document.createElement('p');
  deployTo.className = 'eds-deploy-bar__deploy-to';
  deployTo.textContent = 'Deploy to: AEM Edge Delivery Services';

  info.append(variantLabel, deployTo);

  const spinner = document.createElement('span');
  spinner.className = 'eds-deploy-bar__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinner.hidden = true;

  const btnLabelSpan = document.createElement('span');
  btnLabelSpan.textContent = btnLabelDefault;

  const btn = document.createElement('button');
  btn.className = 'eds-deploy-bar__btn';
  btn.type = 'button';
  btn.disabled = true;
  btn.append(spinner, btnLabelSpan);

  const errorEl = document.createElement('p');
  errorEl.className = 'eds-deploy-bar__error';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;

  bar.append(info, btn);
  block.replaceChildren(bar, errorEl);

  // ── State ──────────────────────────────────────────────────────────────

  let currentVariantIndex = null;
  let currentRunId = null;
  let isDeploying = false;

  // ── Listen for variant selection (remove on re-decoration) ────────────

  // Store ref so we can remove it if EDS re-decorates the block
  function onVariantSelected(e) {
    const { variantIndex, runId } = e.detail ?? {};

    if (variantIndex == null) {
      // Deselected
      currentVariantIndex = null;
      currentRunId = null;
      variantLabel.textContent = 'No variant selected';
      btn.disabled = true;
      bar.setAttribute('aria-hidden', 'true');
      bar.classList.remove('eds-deploy-bar__bar--visible');
      return;
    }

    const labels = { 1: 'A — Safe', 2: 'B — Motivator', 3: 'C — Visionary' };
    currentVariantIndex = variantIndex;
    currentRunId = runId;
    variantLabel.textContent = `${selectedPrefix} ${labels[variantIndex] ?? variantIndex} selected`;
    btn.disabled = false;
    bar.setAttribute('aria-hidden', 'false');
    bar.classList.add('eds-deploy-bar__bar--visible');
    errorEl.hidden = true;
  }

  // Remove any stale listener from a previous decoration, then re-register
  document.removeEventListener('freehold:variant-selected', block._variantListener);
  block._variantListener = onVariantSelected;
  document.addEventListener('freehold:variant-selected', onVariantSelected);

  // ── Deploy handler ─────────────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    if (!currentVariantIndex || !currentRunId || isDeploying) return;

    isDeploying = true;
    btn.disabled = true;
    spinner.hidden = false;
    btnLabelSpan.textContent = 'Deploying…';
    errorEl.hidden = true;

    try {
      const res = await fetch(`${apiBase()}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: currentRunId,
          variantIndex: currentVariantIndex,
          deployTarget: 'eds',
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Deploy failed. Please try again.');
      }

      const { siteId } = await res.json();
      if (!siteId) throw new Error('Unexpected response from deploy API.');

      isDeploying = false;
      window.location.href = `/eds-deploying?siteId=${encodeURIComponent(siteId)}`;
    } catch (ex) {
      errorEl.textContent = ex instanceof Error ? ex.message : 'Deploy failed. Please try again.';
      errorEl.hidden = false;
      btn.disabled = false;
      spinner.hidden = true;
      btnLabelSpan.textContent = btnLabelDefault;
      isDeploying = false;
    }
  });
}
