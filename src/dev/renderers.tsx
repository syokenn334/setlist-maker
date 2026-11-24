/**
 * Renderer comparison (dev only, Phase 2 prototype)
 *
 * Renders a test board that uses the CSS features the redesign may need
 * (CSS filter on a background, object-fit, box-shadow, Noto Sans JP, ellipsis)
 * and exposes capture functions for each DOM-to-image library so
 * scripts/compare-renderers.mjs can compare them with the browser's own rendering.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import html2canvasPro from 'html2canvas-pro';
import { toPng } from 'html-to-image';
import { domToPng, createContext, destroyContext } from 'modern-screenshot';
// Self-hosted fonts (bundled by Vite) instead of the Google Fonts stylesheet
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';

import { Board, WIDTH, HEIGHT } from './RendererBoard.tsx';

async function toBase64(dataUrlOrCanvas: string | HTMLCanvasElement): Promise<string> {
  const url = typeof dataUrlOrCanvas === 'string' ? dataUrlOrCanvas : dataUrlOrCanvas.toDataURL('image/png');
  return url.slice(url.indexOf(',') + 1);
}

const renderers: Record<string, (el: HTMLElement) => Promise<string>> = {
  html2canvas: async (el) => toBase64(await html2canvas(el, { width: WIDTH, height: HEIGHT, scale: 1, useCORS: true, backgroundColor: null })),
  'html2canvas-pro': async (el) => toBase64(await html2canvasPro(el, { width: WIDTH, height: HEIGHT, scale: 1, useCORS: true, backgroundColor: null })),
  'html-to-image': async (el) => toBase64(await toPng(el, { width: WIDTH, height: HEIGHT, pixelRatio: 1 })),
  'modern-screenshot': async (el) => toBase64(await domToPng(el, { width: WIDTH, height: HEIGHT, scale: 1 })),
  // Second capture with a reused context (fonts/images already embedded), as when exporting several pages
  'modern-screenshot-2nd': async (el) => {
    const ctx = await createContext(el, { width: WIDTH, height: HEIGHT, scale: 1 });
    await domToPng(ctx);
    const t0 = performance.now();
    const out = await domToPng(ctx);
    console.log('2nd-capture-ms', Math.round(performance.now() - t0));
    destroyContext(ctx);
    return toBase64(out);
  },
};

declare global {
  interface Window {
    __renderers: {
      names: string[];
      ready: boolean;
      capture: (name: string) => Promise<{ base64: string; ms: number } | { error: string }>;
    };
  }
}

window.__renderers = {
  names: Object.keys(renderers),
  ready: false,
  capture: async (name) => {
    const el = document.getElementById('board')!;
    const t0 = performance.now();
    try {
      const base64 = await renderers[name](el);
      return { base64, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { error: String(e) };
    }
  },
};

document.body.style.margin = '0';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Board />
  </StrictMode>,
);

(async () => {
  // Wait for React to commit the board, then load every glyph it uses.
  await new Promise((r) => setTimeout(r, 100));
  const text = document.getElementById('root')!.textContent ?? '';
  await Promise.all([
    document.fonts.load(`400 28px 'Noto Sans JP'`, text),
    document.fonts.load(`700 56px 'Noto Sans JP'`, text),
    document.fonts.load(`400 28px 'Inter'`, text),
    document.fonts.load(`600 28px 'Inter'`, text),
  ]);
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 300));
  window.__renderers.ready = true;
})();
