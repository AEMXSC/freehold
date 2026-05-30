/**
 * push-to-da.mjs — pushes the 4 Freehold demo content pages to DA
 *
 * Usage:
 *   DA_ADMIN_TOKEN=<your-ims-token> node tools/push-to-da.mjs
 *
 * Get a token: open da.live, open DevTools → Application → Local Storage →
 *   da.live → copy the value of 'imsToken'
 *
 * What this does:
 *   1. Reads each HTML file from the content/ dir alongside this script
 *   2. Sanitises non-ASCII to HTML entities (DA ingestion requirement)
 *   3. PUTs each file to DA Admin API at aemxsc/freehold/<pagename>
 *   4. Triggers EDS preview so the page is immediately visible on *.aem.page
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DA_ADMIN = 'https://admin.da.live'
const HLX_ADMIN = 'https://admin.hlx.page'
const ORG = 'aemxsc'
const REPO = 'freehold'
const BRANCH = 'main'

const TOKEN = process.env.DA_ADMIN_TOKEN
if (!TOKEN) {
  console.error('Missing DA_ADMIN_TOKEN env var')
  console.error('Get it from: da.live DevTools → Application → Local Storage → imsToken')
  process.exit(1)
}

const __dir = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dir, '..', 'content')

const PAGES = ['index', 'pipeline-progress', 'variant-picker', 'live']

function sanitise(html) {
  return html.replace(/[^\x00-\x7F]/g, c => `&#${c.codePointAt(0)};`)
}

async function writeToDA(pagePath, html) {
  const form = new FormData()
  form.append('data', new Blob([html], { type: 'text/html' }))
  const res = await fetch(`${DA_ADMIN}/source/${ORG}/${REPO}${pagePath}.html`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`DA write failed ${res.status}: ${await res.text()}`)
}

async function triggerPreview(pagePath) {
  const res = await fetch(`${HLX_ADMIN}/preview/${ORG}/${REPO}/${BRANCH}${pagePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Preview failed ${res.status}`)
  const data = await res.json()
  return data.preview?.url ?? `https://${BRANCH}--${REPO}--${ORG}.aem.page${pagePath}`
}

async function publishToLive(pagePath) {
  const res = await fetch(`${HLX_ADMIN}/live/${ORG}/${REPO}/${BRANCH}${pagePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Publish failed ${res.status}`)
}

for (const page of PAGES) {
  const pagePath = `/${page === 'index' ? '' : page}`
  const filePath = join(contentDir, `${page}.html`)

  process.stdout.write(`→ ${page} ... `)

  try {
    const raw = await readFile(filePath, 'utf-8')
    const html = sanitise(raw)
    await writeToDA(pagePath === '/' ? '/index' : pagePath, html)
    const previewUrl = await triggerPreview(pagePath === '/' ? '/index' : pagePath)
    await publishToLive(pagePath === '/' ? '/index' : pagePath)
    console.log(`✓ live at ${previewUrl}`)
  } catch (err) {
    console.error(`✗ ${err.message}`)
  }
}

console.log('\nDone. Preview site: https://main--freehold--aemxsc.aem.page')
console.log('Live site:          https://main--freehold--aemxsc.aem.live')
