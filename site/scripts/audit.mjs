// Accessibility and performance audit of the built site (SPEC §9.2, §10.4, §12).
//
//   node scripts/audit.mjs            axe on every sample page (light and dark), Lighthouse on a subset
//   node scripts/audit.mjs --no-lh    axe only
//
// Serves dist/ under the site's base path, gzip-compressed, with 404.html for unknown paths, like
// GitHub Pages.
// Fails on any serious or critical axe violation, a Lighthouse category below 0.95, or LCP above
// 2.5 s. While the site is not indexable, Lighthouse's is-crawlable audit is skipped (noindex is
// intended on the temporary address); embedded widgets are never indexable, so it is always
// skipped for them. The web component on /embed/ must size its frames from the widgets' messages.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { INDEXABLE, SITE_URL } from '../site.config.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const BASE = new URL(SITE_URL).pathname;
const RUN_LH = !process.argv.includes('--no-lh');

const AXE_PAGES = [
  '',
  'countries/',
  'blocks/',
  'countries/fr/',
  'countries/xk/',
  'countries/ps/',
  'countries/aq/',
  'countries/af/', // native_names keys in ISO 639-3 (prs), entries with one name (contract 4)
  'countries/ru/', // route role column, closed border (contract 4.1)
  'countries/ma/', // border crossing status with sources (contract 4.1)
  'blocks/un/',
  'blocks/eu/',
  'blocks/nato/',
  'blocks/afunion/',
  'blocks/g-20/',
  'blocks/afcfta/',
  'blocks/jcpoa/',
  'blocks/unsc/', // institutional design with veto holders (contract 4.1)
  'blocks/btc/', // route roles in the roster (contract 4.1)
  'blocks/iata/', // roster removed: membership_applicability not_applicable (contract 4.1)
  'data/',
  'about/',
  'types/',
  'types/intorg/',
  'topics/',
  'topics/trade/',
  'geography/',
  'geography/europe/',
  'stats/',
  'explore/',
  'explore/map/',
  'explore/map/?mode=count',
  'explore/timeline/',
  'explore/founded/',
  'explore/headquarters/',
  'explore/compare/',
  'explore/compare/?ids=EU,NATO&measure=population&members=only',
  'explore/countries/',
  'explore/hierarchy/?id=UNEP',
  'search/?q=nato',
  'blocks/g20/', // 404 with suggestions
  'embed/',
  'embed/blocks/eu/',
  'embed/blocks/un/',
  'embed/blocks/jcpoa/',
  'embed/countries/fr/',
];
const LH_PAGES = ['', 'countries/fr/', 'blocks/un/', 'blocks/eu/', 'blocks/', 'types/intorg/', 'stats/', 'explore/map/', 'explore/headquarters/', 'explore/compare/', 'embed/blocks/un/', 'embed/countries/fr/'];
const LH_MIN = 0.95;
const LCP_MAX_MS = 2500;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

async function file(path) {
  try {
    const s = await stat(path);
    return s.isDirectory() ? file(join(path, 'index.html')) : path;
  } catch {
    return null;
  }
}

function serve() {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = url.startsWith(BASE) ? url.slice(BASE.length) : null;
    const found = rel === null ? null : await file(normalize(join(DIST, rel)));
    const path = found && found.startsWith(DIST) ? found : join(DIST, '404.html');
    const body = await readFile(path);
    const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    res.writeHead(found ? 200 : 404, {
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    res.end(gzip ? gzipSync(body) : body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const failures = [];
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const pageUrl = (p) => `${origin}${BASE}${p}`;

// axe, in both colour schemes: dark mode has its own colour steps and must pass on its own.
const browser = await chromium.launch();
for (const colorScheme of ['light', 'dark']) {
  const context = await browser.newContext({ colorScheme });
  for (const p of AXE_PAGES) {
    const page = await context.newPage();
    await page.goto(pageUrl(p), { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    for (const v of bad) {
      const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('; ');
      failures.push(`axe ${colorScheme} /${p}: ${v.id} (${v.impact}, ${v.nodes.length} nodes) e.g. ${targets}`);
    }
    console.log(`axe   ${colorScheme.padEnd(5)} /${p} ${bad.length ? `${bad.length} serious/critical` : 'ok'}`);
    await page.close();
  }
  await context.close();
}

// The 404 page must suggest the intended card for a mistyped ID.
{
  const page = await browser.newPage();
  await page.goto(pageUrl('blocks/g20/'), { waitUntil: 'networkidle' });
  const links = await page.locator('[data-suggest] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  if (!links.includes(`${BASE}blocks/g-20/`)) failures.push(`404 /blocks/g20/ does not suggest /blocks/g-20/ (got ${links.join(', ') || 'nothing'})`);
  console.log(`404   /blocks/g20/ suggests ${links.slice(0, 3).join(', ')}`);
  await page.close();
}
// The web component sizes each frame from the height its widget reports.
{
  const page = await browser.newPage();
  await page.goto(pageUrl('embed/'), { waitUntil: 'load' });
  for (const selector of ['internacia-embed[block="EU"]', 'internacia-embed[country="FR"]']) {
    const height = await page.locator(selector).evaluate(async (el) => {
      el.scrollIntoView();
      for (let i = 0; i < 100; i++) {
        const frame = el.shadowRoot?.querySelector('iframe');
        if (frame?.style.height) return frame.style.height;
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    });
    if (!height) failures.push(`embed: ${selector} frame was not sized by the widget`);
    else console.log(`embed ${selector} height ${height}`);
  }
  await page.close();
}

const chromePath = chromium.executablePath();
await browser.close();

if (RUN_LH) {
  const chrome = await launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    for (const p of LH_PAGES) {
      const { lhr } = await lighthouse(pageUrl(p), {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: INDEXABLE && !p.startsWith('embed/') ? [] : ['is-crawlable'],
      });
      const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, c.score]));
      const lcp = lhr.audits['largest-contentful-paint']?.numericValue ?? 0;
      for (const [k, s] of Object.entries(scores)) {
        if (s === null || s < LH_MIN) failures.push(`lighthouse /${p}: ${k} ${s} < ${LH_MIN}`);
      }
      if (lcp > LCP_MAX_MS) failures.push(`lighthouse /${p}: LCP ${Math.round(lcp)} ms > ${LCP_MAX_MS} ms`);
      console.log(
        `lh    /${p} ${Object.entries(scores)
          .map(([k, s]) => `${k} ${s}`)
          .join(', ')}, LCP ${Math.round(lcp)} ms`,
      );
    }
  } finally {
    await chrome.kill();
  }
}

server.close();
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\naudit passed');
