/**
 * Export matrix (dev only)
 *
 * Renders one combination of sample / preset / columns / theme / state per URL
 * (`?case=<id>`) so scripts/export-matrix.mjs can capture every combination with the
 * same path the app uses (SetlistImage + modern-screenshot). Without `?case`, lists all cases as links.
 *
 * Artwork is generated locally (no network) so captures are deterministic.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/fonts.ts';
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
