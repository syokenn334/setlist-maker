/**
 * Export matrix cases and local assets (dev only)
 *
 * One combination of sample / preset / columns / theme / state per URL (`?case=<id>`), so
 * scripts/export-matrix.mjs can capture every combination with the same path the app uses
 * (SetlistImage + modern-screenshot). Artwork, the background photo and the QR code are
 * generated locally (no network) so captures are deterministic.
 */
import { decodeBuffer, parseSetlist } from '../core/parser.ts';
import type { TrackWithArtwork } from '../types/index.ts';
import type { PresetId } from '../core/presets.ts';
import { PRESETS, PRESET_IDS } from '../core/presets.ts';
import type { ThemeId } from '../themes/index.ts';
import { THEMES } from '../themes/index.ts';

const sampleUrls = import.meta.glob('../../samples/*.txt', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const SAMPLES = Object.fromEntries(Object.entries(sampleUrls).map(([path, url]) => [path.split('/').pop()!.replace(/\.txt$/, ''), url]));

export interface MatrixCase {
  id: string;
  sample: string;
  preset: PresetId;
  columns: 1 | 2;
  theme: ThemeId;
  page: number | 'last';
  hidden: number[];
  background: boolean;
  qr: boolean;
  rows: number | null;
  rowFrame: boolean;
  artwork: boolean;
}

function caseId(c: Omit<MatrixCase, 'id'>): string {
  const parts = [c.sample, c.preset.replace(':', 'x'), `c${c.columns}`, c.theme, `p${c.page}`];
  if (c.hidden.length) parts.push('hidden');
  if (c.background) parts.push('bg');
  if (c.qr) parts.push('qr');
  if (c.rows) parts.push(`r${c.rows}`);
  if (!c.rowFrame) parts.push('noframe');
  if (!c.artwork) parts.push('noart');
  return parts.join('__');
}

function buildCases(): MatrixCase[] {
  const list: Omit<MatrixCase, 'id'>[] = [];
  const base = { hidden: [] as number[], background: false, qr: false, page: 0 as number | 'last', rows: null as number | null, rowFrame: true, artwork: true };
  for (const preset of PRESET_IDS) {
    for (const columns of PRESETS[preset].columns) {
      for (const t of THEMES) list.push({ ...base, sample: 'basic-36', preset, columns, theme: t.id });
      list.push({ ...base, sample: 'edge-cases', preset, columns, theme: 'dark' });
      list.push({ ...base, sample: 'basic-36', preset, columns, theme: 'light', page: 'last', qr: true });
    }
  }
  list.push({ ...base, sample: 'basic-36', preset: '16:9', columns: 2, theme: 'dark', hidden: [1, 4, 5] });
  for (const t of THEMES) list.push({ ...base, sample: 'basic-36', preset: '4:5', columns: 1, theme: t.id, hidden: [2], background: true });
  list.push({ ...base, sample: 'basic-36', preset: '16:9', columns: 2, theme: 'dark', rowFrame: false });
  list.push({ ...base, sample: 'basic-36', preset: '4:5', columns: 1, theme: 'dark', rows: 6 });
  list.push({ ...base, sample: 'basic-36', preset: '16:9', columns: 2, theme: 'light', rows: 6, page: 'last', qr: true });
  list.push({ ...base, sample: 'basic-36', preset: '16:9', columns: 2, theme: 'dark', artwork: false });
  list.push({ ...base, sample: 'edge-cases', preset: '4:5', columns: 1, theme: 'light', artwork: false, hidden: [1] });
  list.push({ ...base, sample: 'large-120', preset: '4:5', columns: 1, theme: 'dark', page: 'last' });
  list.push({ ...base, sample: 'utf16le-10', preset: '1:1', columns: 1, theme: 'warm' });
  return list.map((c) => ({ ...c, id: caseId(c) }));
}

export const CASES = buildCases();

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Solid-colour square derived from the track name; every 7th track has no artwork, every 11th is a substitute. */
function placeholderArtwork(track: { title?: string; artist?: string }, index: number): Pick<TrackWithArtwork, 'artworkUrl' | 'artworkMatch'> {
  if (index % 7 === 6) return { artworkUrl: null, artworkMatch: 'none' };
  const c = document.createElement('canvas'); c.width = 120; c.height = 120;
  const ctx = c.getContext('2d')!;
  const h = hash(`${track.artist ?? ''}/${track.title ?? ''}`);
  ctx.fillStyle = `hsl(${h % 360} 45% 45%)`; ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = `hsl(${(h >> 9) % 360} 45% 65%)`; ctx.fillRect(0, 60, 120, 60);
  return { artworkUrl: c.toDataURL('image/png'), artworkMatch: index % 11 === 10 ? 'substitute' : 'exact' };
}

/** Blocky stand-in for a user background photo (landscape, 1600x1000) */
export function placeholderBackground(): { src: string; width: number; height: number } {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 1000; y += 100) for (let x = 0; x < 1600; x += 100) {
    ctx.fillStyle = `hsl(${(x * 0.2 + y * 0.1) % 360} 50% ${30 + ((x + y) % 40)}%)`; ctx.fillRect(x, y, 100, 100);
  }
  return { src: c.toDataURL('image/png'), width: 1600, height: 1000 };
}

export async function loadTracks(sample: string): Promise<TrackWithArtwork[]> {
  const url = SAMPLES[sample];
  if (!url) throw new Error(`unknown sample: ${sample}`);
  const { tracks } = parseSetlist(decodeBuffer(await (await fetch(url)).arrayBuffer()));
  return tracks.map((t, i) => ({ ...t, ...placeholderArtwork(t, i) }));
}

export async function waitForImages(root: HTMLElement): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map((img) =>
    img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r(); })));
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(blob); });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export interface MatrixApi { cases: string[]; ready: boolean; error: string | null; capture: () => Promise<string> }
declare global { interface Window { __matrix: MatrixApi } }
