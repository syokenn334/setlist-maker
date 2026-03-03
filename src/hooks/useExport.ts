import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';

export function useExport() {
  const [exporting, setExporting] = useState(false);

  const captureElement = async (element: HTMLElement): Promise<string> => {
    const canvas = await html2canvas(element, {
      width: 1600,
      height: 900,
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

  const exportPng = useCallback(async (element: HTMLElement | null, fileName: string) => {
    if (!element) return;
    setExporting(true);

    try {
      await document.fonts.ready;
      const url = await captureElement(element);
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
  ) => {
    setExporting(true);

    try {
      await document.fonts.ready;

      for (let i = 0; i < pageCount; i++) {
        setPage(i);
        // Allow React to re-render with new page
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        const el = getElement();
        if (!el) continue;

        const url = await captureElement(el);
        const suffix = pageCount > 1 ? `_${i + 1}` : '';
        download(url, `${baseName}${suffix}.png`);
      }
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportPng, exportAllPages };
}
