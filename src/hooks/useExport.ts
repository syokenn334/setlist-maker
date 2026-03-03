import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';

export interface CanvasSize {
  width: number;
  height: number;
}

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const captureElement = async (
    element: HTMLElement,
    size: CanvasSize = { width: 1600, height: 900 },
  ): Promise<string> => {
    const canvas = await html2canvas(element, {
      width: size.width,
      height: size.height,
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      onclone: (_doc, clonedEl) => {
        let parent = clonedEl.parentElement;
        while (parent) {
          parent.style.transform = 'none';
          parent.style.overflow = 'visible';
          parent = parent.parentElement;
        }
      },
    });
    return canvas.toDataURL('image/png');
  };

  const download = (dataUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const exportPng = useCallback(async (
    element: HTMLElement | null,
    fileName: string,
    size?: CanvasSize,
  ) => {
    if (!element) return;
    setExporting(true);

    try {
      await document.fonts.ready;
      const url = await captureElement(element, size);
      download(url, fileName);
    } finally {
      setExporting(false);
    }
  }, []);

  const exportAllPages = useCallback(async (
    getElement: () => HTMLElement | null,
    setPage: (page: number) => void,
    pageCount: number,
    baseName: string,
    size?: CanvasSize,
  ) => {
    setExporting(true);

    try {
      await document.fonts.ready;

      for (let i = 0; i < pageCount; i++) {
        flushSync(() => setPage(i));
        // Wait one frame for layout/paint after synchronous render
        await new Promise((r) => requestAnimationFrame(r));

        const el = getElement();
        if (!el) continue;

        const url = await captureElement(el, size);
        const suffix = pageCount > 1 ? `_${i + 1}` : '';
        download(url, `${baseName}${suffix}.png`);
      }
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportPng, exportAllPages };
}
