/**
 * 生成画像の書き出し (docs/design-system.md 3.3)
 *
 * modern-screenshot はブラウザ自身の描画を SVG foreignObject 経由で画像にするので、
 * CSS の filter / object-fit / ellipsis がプレビューと同じに出る。フォントはアプリに同梱
 * (@fontsource) したものを埋め込む (Google Fonts だと欧文が埋め込まれないことがあった)。
 */
import { domToBlob } from 'modern-screenshot';
import { zipSync } from 'fflate';

export interface ExportSize {
  width: number;
  height: number;
  scale: number;
}

export async function captureImage(element: HTMLElement, size: ExportSize): Promise<Blob> {
  await document.fonts.ready;
  // Make sure every glyph on this page is loaded before capturing (fonts are split by unicode-range)
  const text = element.textContent ?? '';
  await Promise.all([
    document.fonts.load("400 18px 'Noto Sans JP'", text),
    document.fonts.load("700 24px 'Noto Sans JP'", text),
    document.fonts.load("400 18px 'Inter'", text),
    document.fonts.load("700 24px 'Inter'", text),
  ]);
  return domToBlob(element, { width: size.width, height: size.height, scale: size.scale, type: 'image/png' });
}

/** X の画像の上限 (5MB)。Instagram (8MB) もこれで収まる */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * 写真の背景を 2 倍で書き出すと PNG が上限を超えることがあるので、超えたページだけ
 * JPEG に変換する。文字のにじみを抑えるため品質は高い方から試す。
 */
export async function fitFileSize(blob: Blob, maxBytes = MAX_FILE_BYTES): Promise<Blob> {
  if (blob.size <= maxBytes) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  let jpeg: Blob | null = null;
  for (const quality of [0.95, 0.9, 0.85, 0.8]) {
    jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (jpeg && jpeg.size <= maxBytes) break;
  }
  return jpeg ?? blob;
}

export function extensionOf(blob: Blob): string {
  return blob.type === 'image/jpeg' ? 'jpg' : 'png';
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has started the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  // PNG / JPEG are already compressed: store without deflate
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped], { type: 'application/zip' });
}

/** Web Share API でファイルを共有できる環境か */
export function canShareFiles(files: File[]): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files });
}

export async function shareFiles(files: File[], title: string): Promise<void> {
  await navigator.share({ files, title });
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'setlist';
}
