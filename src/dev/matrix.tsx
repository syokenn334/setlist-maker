/**
 * Export matrix (dev only)
 *
 * Renders one combination of sample / aspect ratio / columns / theme / page per URL
 * (`?case=<id>`) so scripts/export-matrix.mjs can capture every combination with the
 * same html2canvas path the app uses. Without `?case`, lists all cases as links.
 *
 * Artwork is generated locally (no network) so captures are deterministic.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { CASES } from './matrixCases.ts';
import { Matrix } from './MatrixApp.tsx';

window.__matrix = {
  cases: CASES.map((c) => c.id),
  ready: false,
  error: null,
  capture: async () => { throw new Error('not ready'); },
};

document.body.style.overflow = 'auto';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Matrix />
  </StrictMode>,
);
