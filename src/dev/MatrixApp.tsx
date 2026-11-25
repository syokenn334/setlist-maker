import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { TrackWithArtwork } from '../types/index.ts';
import { PRESETS } from '../core/presets.ts';
import { computeGeometry } from '../core/imageLayout.ts';
import { paginate } from '../core/pagination.ts';
import { DEFAULT_BACKGROUND } from '../core/background.ts';
import type { BackgroundSettings } from '../core/background.ts';
import { captureImage } from '../core/exportImage.ts';
import { themeById } from '../themes/index.ts';
import { SetlistImage } from '../image/SetlistImage.tsx';
import type { MatrixCase } from './matrixCases.ts';
import { CASES, blobToBase64, loadTracks, placeholderBackground, waitForImages } from './matrixCases.ts';

function CaseList() {
  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 16, marginBottom: 12 }}>Export matrix ({CASES.length} cases)</h1>
      <ul style={{ listStyle: 'none', fontSize: 13, lineHeight: 1.8 }}>
        {CASES.map((c) => <li key={c.id}><a style={{ color: 'inherit' }} href={`?case=${c.id}`}>{c.id}</a></li>)}
      </ul>
    </div>
  );
}

function CaseView({ c }: { c: MatrixCase }) {
  const [tracks, setTracks] = useState<TrackWithArtwork[] | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [background] = useState<BackgroundSettings>(() => {
    if (!c.background) return DEFAULT_BACKGROUND;
    const p = placeholderBackground();
    return { ...DEFAULT_BACKGROUND, src: p.src, naturalWidth: p.width, naturalHeight: p.height, x: 30, y: 50, zoom: 1.2, saturate: 0.4, brightness: 0.8, blur: 4, overlay: 0.6 };
  });
  const ref = useRef<HTMLDivElement>(null);
  const preset = PRESETS[c.preset];
  const theme = themeById(c.theme);

  useEffect(() => {
    loadTracks(c.sample).then(setTracks).catch((e: unknown) => { window.__matrix.error = String(e); });
    if (c.qr) QRCode.toDataURL('https://www.youtube.com/playlist?list=PLmatrix000000000000000000000000000', { margin: 2, width: 512 }).then(setQr);
  }, [c.sample, c.qr]);

  const g = computeGeometry(preset, c.columns, c.rows);
  const slices = tracks ? paginate({ total: tracks.length, rows: g.rows, columns: c.columns, qrRows: g.qrRows, qr: c.qr }) : [];
  const page = c.page === 'last' ? slices.length - 1 : Math.min(c.page, slices.length - 1);
  const ready = tracks && (!c.qr || qr);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 300));
      const el = ref.current?.firstElementChild as HTMLElement | null;
      if (!el || cancelled) return;
      await waitForImages(el);
      window.__matrix.capture = async () => blobToBase64(await captureImage(el, { width: preset.width, height: preset.height, scale: 1 }));
      window.__matrix.ready = true;
    })();
    return () => { cancelled = true; };
  }, [ready, preset]);

  if (!tracks || slices.length === 0) return null;
  return (
    <div ref={ref}>
      <SetlistImage
        preset={preset}
        columns={c.columns}
        rowsLimit={c.rows}
        rowFrame={c.rowFrame}
        showArtwork={c.artwork}
        theme={theme}
        metadata={{ eventName: 'Sample Event', djName: 'DJ Sample', date: '2026.11.24' }}
        tracks={tracks}
        slice={slices[page]}
        pageIndex={page}
        pageCount={slices.length}
        hidden={new Set(c.hidden)}
        background={background}
        qrDataUrl={qr}
      />
    </div>
  );
}

function UnknownCase({ id }: { id: string }) {
  useEffect(() => { window.__matrix.error = `unknown case: ${id}`; }, [id]);
  return <div style={{ padding: 24 }}>unknown case: {id}</div>;
}

export function Matrix() {
  const id = new URLSearchParams(location.search).get('case');
  if (!id) return <CaseList />;
  const c = CASES.find((x) => x.id === id);
  return c ? <CaseView c={c} /> : <UnknownCase id={id} />;
}
