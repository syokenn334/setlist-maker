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
  ): Promise<Blob> => {
    const hiRes = await html2canvas(element, {
      width: size.width,
      height: size.height,
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      onclone: (doc, clonedEl) => {
        let parent = clonedEl.parentElement;
        while (parent) {
          parent.style.transform = 'none';
          parent.style.overflow = 'visible';
          parent = parent.parentElement;
        }

        // html2canvas doesn't render text-overflow: ellipsis.
        // Manually truncate overflowing text with "…".
        const getStyle = doc.defaultView?.getComputedStyle.bind(doc.defaultView)
          ?? window.getComputedStyle;
        clonedEl.querySelectorAll('*').forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const cs = getStyle(node);
          if (cs.textOverflow !== 'ellipsis' || cs.overflow !== 'hidden') return;
          if (node.scrollWidth <= node.clientWidth) return;

          const original = node.textContent ?? '';
          node.style.textOverflow = 'clip';
          let lo = 0;
          let hi = original.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            node.textContent = original.slice(0, mid) + '\u2026';
            if (node.scrollWidth > node.clientWidth) {
              hi = mid - 1;
            } else {
              lo = mid;
            }
          }
          node.textContent = original.slice(0, lo) + '\u2026';
        });
      },
    });

    return new Promise<Blob>((resolve, reject) => {
      hiRes.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });
  };

  const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
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
      const blob = await captureElement(element, size);
      download(blob, fileName);
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

        const blob = await captureElement(el, size);
        const suffix = pageCount > 1 ? `_${i + 1}` : '';
        download(blob, `${baseName}${suffix}.png`);
      }
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportPng, exportAllPages };
}
