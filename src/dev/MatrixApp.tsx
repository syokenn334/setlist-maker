import { useEffect, useRef, useState } from 'react';
import type { TrackWithArtwork } from '@core/layout.ts';
import { CANVAS_SIZES } from '@core/layout.ts';
import { templates } from '../templates/index.ts';
import { captureElement } from '../hooks/useExport.ts';
import { SetlistPreview } from '../preview/SetlistPreview.tsx';
import type { SetlistPreviewHandle } from '../preview/SetlistPreview.tsx';
import type { MatrixCase } from './matrixCases.ts';
import { CASES, blobToBase64, loadTracks, placeholderBackground, waitForImages } from './matrixCases.ts';

function CaseList() {
  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: 16, marginBottom: 12 }}>Export matrix ({CASES.length} cases)</h1>
      <ul style={{ listStyle: 'none', fontSize: 13, lineHeight: 1.8 }}>
        {CASES.map((c) => (
          <li key={c.id}><a style={{ color: 'inherit' }} href={`?case=${c.id}`}>{c.id}</a></li>
        ))}
      </ul>
    </div>
  );
}

function CaseView({ matrixCase }: { matrixCase: MatrixCase }) {
  const [tracks, setTracks] = useState<TrackWithArtwork[] | null>(null);
  const [background] = useState(() => (matrixCase.background ? placeholderBackground() : null));
  const previewRef = useRef<SetlistPreviewHandle>(null);

  const size = CANVAS_SIZES[matrixCase.aspect];
  const template = templates.find((t) => t.id === matrixCase.templateId) ?? templates[0];

  useEffect(() => {
    loadTracks(matrixCase.sample).then(setTracks).catch((e: unknown) => {
      window.__matrix.error = String(e);
    });
  }, [matrixCase.sample]);

  // Page split mirrors App.tsx (no logo): rows x columns per page.
  const perPage = matrixCase.rowsPerPage * matrixCase.columns;
  const pageCount = tracks ? Math.max(1, Math.ceil(tracks.length / perPage)) : 1;
  const page = matrixCase.page === 'last' ? pageCount - 1 : Math.min(matrixCase.page, pageCount - 1);
  const pageTracks = tracks ? tracks.slice(page * perPage, (page + 1) * perPage) : [];

  useEffect(() => {
    if (!tracks) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      // Let the preview's scale animation settle before reporting ready.
      await new Promise((r) => setTimeout(r, 600));
      const el = previewRef.current?.getCanvasElement();
      if (!el || cancelled) return;
      await waitForImages(el);
      window.__matrix.capture = async () => blobToBase64(await captureElement(el, size));
      window.__matrix.ready = true;
    })();
    return () => { cancelled = true; };
  }, [tracks, size]);

  if (!tracks) return null;

  return (
    <div style={{ width: size.width, height: size.height, display: 'flex' }}>
      <SetlistPreview
        ref={previewRef}
        tracks={pageTracks}
        metadata={{ eventName: 'Sample Event', djName: 'DJ Sample', date: '2026.11.24' }}
        template={template}
        backgroundImage={background}
        overlayOpacity={0.8}
        rowsPerPage={matrixCase.rowsPerPage}
        columnCount={matrixCase.columns}
        aspectRatio={matrixCase.aspect}
        pageIndex={page}
        pageCount={pageCount}
        totalTrackCount={tracks.length}
        globalIndexStart={page * perPage}
        hiddenTracks={new Set(matrixCase.hiddenIndexes)}
      />
    </div>
  );
}

function UnknownCase({ id }: { id: string }) {
  useEffect(() => {
    window.__matrix.error = `unknown case: ${id}`;
  }, [id]);
  return <div style={{ padding: 24 }}>unknown case: {id}</div>;
}

export function Matrix() {
  const id = new URLSearchParams(location.search).get('case');
  if (!id) return <CaseList />;
  const matrixCase = CASES.find((c) => c.id === id);
  if (!matrixCase) return <UnknownCase id={id} />;
  return <CaseView matrixCase={matrixCase} />;
}

