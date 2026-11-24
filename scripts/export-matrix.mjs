// Captures every case of the dev export matrix (dev/matrix.html) as PNG and compares
// them with baseline images.
//
// Usage:
//   npm run matrix            capture into .matrix/current and diff against .matrix/baseline
//   npm run matrix:update     capture and overwrite .matrix/baseline
//   npm run matrix -- <text>  only cases whose id contains <text>
//
// Starts its own Vite dev server on a free port and stops it (and the browser) on exit.
// Chromium runs with its sandbox enabled.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, '.matrix');
const dirs = {
  current: join(outRoot, 'current'),
  baseline: join(outRoot, 'baseline'),
  diff: join(outRoot, 'diff'),
};

const args = process.argv.slice(2);
const update = args.includes('--update');
const filter = args.find((a) => !a.startsWith('--')) ?? '';

function comparePng(currentPath, baselinePath, diffPath) {
  const a = PNG.sync.read(readFileSync(currentPath));
  const b = PNG.sync.read(readFileSync(baselinePath));
  if (a.width !== b.width || a.height !== b.height) {
    return { status: 'size', detail: `${b.width}x${b.height} -> ${a.width}x${a.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  if (pixels === 0) return { status: 'same', detail: '' };
  writeFileSync(diffPath, PNG.sync.write(diff));
  return { status: 'changed', detail: `${((pixels / (a.width * a.height)) * 100).toFixed(2)}%` };
}

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 0, strictPort: false, open: false },
});
let browser;

try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const matrixUrl = new URL('dev/matrix.html', base).href;

  browser = await chromium.launch({ chromiumSandbox: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1800 }, deviceScaleFactor: 1 });

  await page.goto(matrixUrl);
  await page.waitForFunction(() => window.__matrix !== undefined);
  const allCases = await page.evaluate(() => window.__matrix.cases);
  const cases = allCases.filter((id) => id.includes(filter));

  const target = update ? dirs.baseline : dirs.current;
  rmSync(dirs.diff, { recursive: true, force: true });
  if (!filter) rmSync(target, { recursive: true, force: true });
  for (const d of [target, dirs.diff]) mkdirSync(d, { recursive: true });

  console.log(`capturing ${cases.length} cases -> ${target}`);
  const results = [];
  for (const id of cases) {
    await page.goto(`${matrixUrl}?case=${encodeURIComponent(id)}`);
    await page.waitForFunction(() => window.__matrix.ready || window.__matrix.error, null, { timeout: 30000 });
    const error = await page.evaluate(() => window.__matrix.error);
    if (error) {
      results.push({ id, status: 'error', detail: error });
      continue;
    }
    const base64 = await page.evaluate(() => window.__matrix.capture());
    const file = join(target, `${id}.png`);
    writeFileSync(file, Buffer.from(base64, 'base64'));

    if (update) {
      results.push({ id, status: 'baseline', detail: '' });
    } else {
      const baselinePath = join(dirs.baseline, `${id}.png`);
      results.push(existsSync(baselinePath)
        ? { id, ...comparePng(file, baselinePath, join(dirs.diff, `${id}.png`)) }
        : { id, status: 'new', detail: 'no baseline' });
    }
  }

  // Baselines whose case no longer exists (renamed or removed).
  if (!update && !filter && existsSync(dirs.baseline)) {
    const known = new Set(cases.map((id) => `${id}.png`));
    for (const f of readdirSync(dirs.baseline)) {
      if (!known.has(f)) results.push({ id: f.replace(/\.png$/, ''), status: 'missing', detail: 'case removed' });
    }
  }

  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id}${r.detail ? `  (${r.detail})` : ''}`);
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log('\nsummary:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
  if (results.some((r) => r.status === 'error')) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
