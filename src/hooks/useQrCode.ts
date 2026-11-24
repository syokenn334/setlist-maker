import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { ImageTheme } from '../themes/index.ts';

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

/**
 * QR code as a PNG data URL. Modules are always dark on light (inverted QR codes are not read
 * reliably by every scanner): light themes use the theme colors, dark themes get a light card.
 */
export function useQrCode(url: string | null, theme: ImageTheme): string | null {
  const [dataUrl, setDataUrl] = useState<{ key: string; value: string } | null>(null);
  const key = url ? `${url}|${theme.id}` : '';
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const light = isLight(theme.bg);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: light ? theme.textPrimary : '#111111', light: light ? theme.bg : '#eeeeee' },
    }).then((value) => { if (!cancelled) setDataUrl({ key: `${url}|${theme.id}`, value }); });
    return () => { cancelled = true; };
  }, [url, theme]);
  return url && dataUrl?.key === key ? dataUrl.value : null;
}
