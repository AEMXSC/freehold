/**
 * live-preview — shows the deployed EDS site with DA edit CTA
 *
 * Reads siteId from ?siteId= URL param. Fetches site data to get live URL.
 * Handles the deploying/pending state with a polling fallback.
 *
 * Authoring rows (optional):
 *   1. DA edit button label
 *   2. Open site button label
 *
 * Page metadata required:
 *   freehold-api | https://app.freehold.dev
 */

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 80;

const ALLOWED_LIVE_HOSTS = /^[a-z0-9-]+\.(aem\.live|aem\.page)$/i;
const ALLOWED_DA_HOSTS = /^da\.live$/i;
const COPY_FEEDBACK_MS = 2000;

function apiBase() {
  return document.querySelector('meta[name="freehold-api"]')?.content
    ?? 'https://app.freehold.dev';
}

// Only allow https:// URLs on known safe hostnames
function safeUrl(raw, hostPattern) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && hostPattern.test(u.hostname) ? raw : null;
  } catch {
    return null;
  }
}

function buildActionBtn(label, href, primary) {
  const a = document.createElement('a');
  a.className = primary
    ? 'live-preview__action live-preview__action--primary'
    : 'live-preview__action live-preview__action--secondary';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  return a;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const editLabel = rows[0]?.firstElementChild?.textContent.trim() || 'Edit in DA →';
  const openLabel = rows[1]?.firstElementChild?.textContent.trim() || 'Open live site ↗';

  const params = new URLSearchParams(window.location.search);
  const siteId = params.get('siteId');

  if (!siteId) {
    const err = document.createElement('p');
    err.className = 'live-preview__error';
    err.textContent = 'No site ID found.';
    const link = document.createElement('a');
    link.href = '/';
    link.textContent = 'Start over →';
    block.replaceChildren(err, link);
    return;
  }

  // ── Loading state ──────────────────────────────────────────────────────

  const loadingEl = document.createElement('p');
  loadingEl.className = 'live-preview__loading';
  loadingEl.textContent = 'Fetching your live site…';
  block.replaceChildren(loadingEl);

  // ── Poll until url_deployed is set ────────────────────────────────────

  let site = null;
  let polls = 0;
  let stopped = false;
  window.addEventListener('pagehide', () => { stopped = true; }, { once: true });

  while (!stopped && polls < MAX_POLLS) {
    polls++;
    try {
      const res = await fetch(
        `${apiBase()}/api/sites/${encodeURIComponent(siteId)}/eds-status`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.url_deployed) {
          site = data;
          break;
        }
        if (data.eds_deploy_status?.status === 'error') {
          const err = document.createElement('p');
          err.className = 'live-preview__error';
          err.setAttribute('role', 'alert');
          err.textContent = data.eds_deploy_status.message ?? 'Deploy failed.';
          const link = document.createElement('a');
          link.href = '/';
          link.textContent = 'Start over →';
          block.replaceChildren(err, link);
          return;
        }
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!site) {
    const err = document.createElement('p');
    err.className = 'live-preview__error';
    err.textContent = 'Site is not live yet. Please check back in a moment.';
    block.replaceChildren(err);
    return;
  }

  // ── Build layout ───────────────────────────────────────────────────────

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'live-preview__topbar';

  const urlDisplay = document.createElement('span');
  urlDisplay.className = 'live-preview__url';
  // textContent is safe — no innerHTML with user data
  urlDisplay.textContent = site.url_deployed.replace(/^https?:\/\//, '');

  const actions = document.createElement('div');
  actions.className = 'live-preview__actions';

  // Validate URLs from API before use — guards against javascript: URIs
  const safeDeployedUrl = safeUrl(site.url_deployed, ALLOWED_LIVE_HOSTS);
  const safeEditUrl = site.da_edit_url ? safeUrl(site.da_edit_url, ALLOWED_DA_HOSTS) : null;

  if (!safeDeployedUrl) {
    const err = document.createElement('p');
    err.className = 'live-preview__error';
    err.textContent = 'Deployed URL is not valid.';
    block.replaceChildren(err);
    return;
  }

  if (safeEditUrl) {
    actions.append(buildActionBtn(editLabel, safeEditUrl, true));
  }
  actions.append(buildActionBtn(openLabel, safeDeployedUrl, false));

  topBar.append(urlDisplay, actions);

  // Success badge
  const badge = document.createElement('div');
  badge.className = 'live-preview__badge';
  badge.setAttribute('role', 'status');
  badge.textContent = '✓ Live on AEM EDS';

  // Iframe
  const iframeWrap = document.createElement('div');
  iframeWrap.className = 'live-preview__iframe-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'live-preview__iframe';
  iframe.title = 'Live site preview';
  iframe.src = safeDeployedUrl;
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms');
  iframeWrap.append(iframe);

  // Copy URL bar
  const copyBar = document.createElement('div');
  copyBar.className = 'live-preview__copy-bar';

  const copyInput = document.createElement('input');
  copyInput.className = 'live-preview__copy-input';
  copyInput.type = 'text';
  copyInput.readOnly = true;
  copyInput.value = safeDeployedUrl;
  copyInput.setAttribute('aria-label', 'Live site URL');

  const copyBtn = document.createElement('button');
  copyBtn.className = 'live-preview__copy-btn';
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy URL';

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(safeDeployedUrl);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, COPY_FEEDBACK_MS);
    } catch {
      // Clipboard not available — select the input as fallback
      copyInput.select();
      copyBtn.textContent = 'Select URL';
    }
  });

  copyBar.append(copyInput, copyBtn);
  block.replaceChildren(badge, topBar, iframeWrap, copyBar);
}
