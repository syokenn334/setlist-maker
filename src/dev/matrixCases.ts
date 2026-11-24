/**
 * Export matrix cases and local assets (dev only)
 *
 * Renders one combination of sample / aspect ratio / columns / theme / page per URL
 * (`?case=<id>`) so scripts/export-matrix.mjs can capture every combination with the
 * same html2canvas path the app uses. Without `?case`, lists all cases as links.
 *
 * Artwork is generated locally (no network) so captures are deterministic.
 */
import { decodeBuffer, parseSetlist } from '@core/parser.ts';
import type { AspectRatio, TrackWithArtwork } from '@core/layout.ts';
import { CANVAS_SIZES } from '@core/layout.ts';
import { templates } from '../templates/index.ts';

const sampleUrls = import.meta.glob('../../samples/*.txt', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function sampleName(path: string): string {
  return path.split('/').pop()!.replace(/\.txt$/, '');
}

const SAMPLES = Object.fromEntries(
  Object.entries(sampleUrls).map(([path, url]) => [sampleName(path), url]),
);

export interface MatrixCase {
  id: string;
  sample: string;
  aspect: AspectRatio;
  columns: 1 | 2;
  templateId: string;
  rowsPerPage: number;
  page: number | 'last';
  hiddenIndexes: number[];
  background: boolean;
}

function caseId(c: Omit<MatrixCase, 'id'>): string {
  const parts = [
    c.sample,
    c.aspect.replace(':', 'x'),
    `c${c.columns}`,
    c.templateId,
    `r${c.rowsPerPage}`,
    `p${c.page}`,
  ];
  if (c.hiddenIndexes.length > 0) parts.push('hidden');
  if (c.background) parts.push('bg');
  return parts.join('__');
}

/** Columns allowed per aspect ratio (mirrors App.tsx: 2 columns only on 16:9). */
function columnsFor(aspect: AspectRatio): (1 | 2)[] {
  return aspect === '16:9' ? [1, 2] : [1];
}

function buildCases(): MatrixCase[] {
  const list: Omit<MatrixCase, 'id'>[] = [];
  const aspects = Object.keys(CANVAS_SIZES) as AspectRatio[];

  // Every layout x every theme with the standard sample.
  for (const aspect of aspects) {
    for (const columns of columnsFor(aspect)) {
      for (const t of templates) {
        list.push({ sample: 'basic-36', aspect, columns, templateId: t.id, rowsPerPage: 18, page: 0, hiddenIndexes: [], background: false });
      }
    }
  }

  // States checked on the default theme only.
  const base = { templateId: templates[0].id, rowsPerPage: 18, hiddenIndexes: [] as number[], background: false };
  for (const aspect of aspects) {
    for (const columns of columnsFor(aspect)) {
      list.push({ ...base, sample: 'edge-cases', aspect, columns, page: 0 });
    }
  }
  list.push({ ...base, sample: 'basic-36', aspect: '16:9', columns: 2, page: 0, hiddenIndexes: [1, 4, 5] });
  for (const t of templates) {
    list.push({ ...base, templateId: t.id, sample: 'basic-36', aspect: '16:9', columns: 2, page: 0, hiddenIndexes: [2], background: true });
  }
  list.push({ ...base, sample: 'large-120', aspect: '16:9', columns: 1, page: 'last' });
  list.push({ ...base, sample: 'basic-36', aspect: '16:9', columns: 1, rowsPerPage: 8, page: 'last' });
  list.push({ ...base, sample: 'utf16le-10', aspect: '7:8', columns: 1, page: 0 });

  return list.map((c) => ({ ...c, id: caseId(c) }));
}

export const CASES = buildCases();

// --- Deterministic local assets ---

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Solid-colour square derived from the track name; every 7th track has no artwork. */
function placeholderArtwork(track: { title?: string; artist?: string }, index: number): string | null {
  if (index % 7 === 6) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;
  const h = hash(`${track.artist ?? ''}/${track.title ?? ''}`);
  ctx.fillStyle = `hsl(${h % 360} 45% 45%)`;
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = `hsl(${(h >> 9) % 360} 45% 65%)`;
  ctx.fillRect(0, 60, 120, 60);
  return canvas.toDataURL('image/png');
}

/** Blocky pattern used as a stand-in for a user background photo. */
export function placeholderBackground(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < 180; y += 20) {
    for (let x = 0; x < 320; x += 20) {
      ctx.fillStyle = `hsl(${(x + y) % 360} 40% ${30 + ((x * y) % 40)}%)`;
      ctx.fillRect(x, y, 20, 20);
    }
  }
  return canvas.toDataURL('image/png');
}

export async function loadTracks(sample: string): Promise<TrackWithArtwork[]> {
  const url = SAMPLES[sample];
  if (!url) throw new Error(`unknown sample: ${sample}`);
  const buffer = await (await fetch(url)).arrayBuffer();
  const { tracks } = parseSetlist(decodeBuffer(buffer));
  return tracks.map((t, i) => ({ ...t, artworkUrl: placeholderArtwork(t, i) }));
}

export async function waitForImages(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r(); }),
    ),
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export interface MatrixApi {
  cases: string[];
  ready: boolean;
  error: string | null;
  capture: () => Promise<string>;
}

declare global {
  interface Window {
    __matrix: MatrixApi;
  }
}

