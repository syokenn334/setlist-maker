// Phase 2 prototype: compares DOM-to-image libraries against the browser's own
// rendering of dev/renderers.html in Chromium, Firefox and WebKit.
// Usage: node scripts/compare-renderers.mjs
// Output: .matrix/renderers/<browser>/<renderer>.png (+ reference.png, diff-*.png)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, '.matrix', 'renderers');

const server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false } });
await server.listen();
const url = new URL('dev/renderers.html', server.resolvedUrls.local[0]).href;

const browsers = [
  ['chromium', () => chromium.launch({ chromiumSandbox: true })],
  ['firefox', () => firefox.launch()],
  ['webkit', () => webkit.launch()],
];

const rows = [];
try {
  for (const [name, launch] of browsers) {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.text().startsWith('2nd-capture-ms')) rows.push({ browser: name, renderer: '  (2nd capture)', result: m.text() }); });
      await page.goto(url);
      await page.waitForFunction(() => window.__renderers?.ready, null, { timeout: 60000 });
      const dir = join(outRoot, name);
      mkdirSync(dir, { recursive: true });
      const refBuf = await page.locator('#board').screenshot();
      writeFileSync(join(dir, 'reference.png'), refBuf);
      const ref = PNG.sync.read(refBuf);
      const names = await page.evaluate(() => window.__renderers.names);
      for (const r of names) {
        const res = await page.evaluate((n) => window.__renderers.capture(n), r);
        if ('error' in res) {
          rows.push({ browser: name, renderer: r, result: `error: ${res.error.slice(0, 80)}` });
          continue;
        }
        const buf = Buffer.from(res.base64, 'base64');
        writeFileSync(join(dir, `${r}.png`), buf);
        const img = PNG.sync.read(buf);
        if (img.width !== ref.width || img.height !== ref.height) {
          rows.push({ browser: name, renderer: r, result: `size ${img.width}x${img.height}`, ms: res.ms });
          continue;
        }
        const diff = new PNG({ width: ref.width, height: ref.height });
        const px = pixelmatch(img.data, ref.data, diff.data, ref.width, ref.height, { threshold: 0.1 });
        writeFileSync(join(dir, `diff-${r}.png`), PNG.sync.write(diff));
        rows.push({ browser: name, renderer: r, result: `${((px / (ref.width * ref.height)) * 100).toFixed(2)}% differs`, ms: res.ms });
      }
      if (errors.length) rows.push({ browser: name, renderer: '(page errors)', result: errors.join(' | ').slice(0, 200) });
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
for (const r of rows) console.log(`${r.browser.padEnd(9)} ${r.renderer.padEnd(18)} ${String(r.result).padEnd(22)} ${r.ms !== undefined ? `${r.ms} ms` : ''}`);
