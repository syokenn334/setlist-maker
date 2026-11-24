/**
 * 背景画像の配置 (実装計画 1.3)
 *
 * - zoom 1 (100%) = 画像の短い辺をキャンバスに合わせて全体を覆う大きさ (cover)。これが下限
 * - x / y (0〜100) は、はみ出した分のうちどこを見せるか。はみ出していない方向は動かせない
 */

export interface BackgroundSettings {
  /** data URL (読み込み時に縮小済み) */
  src: string | null;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  zoom: number;
  /** 1 = 元のまま */
  saturate: number;
  brightness: number;
  /** px */
  blur: number;
  /** 0〜1。テーマの背景色を重ねる濃さ */
  overlay: number;
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  src: null, naturalWidth: 0, naturalHeight: 0,
  x: 50, y: 50, zoom: 1, saturate: 1, brightness: 1, blur: 0, overlay: 0.7,
};

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export interface BackgroundPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 動かせる量 (px)。0 ならその方向には動かせない */
  overflowX: number;
  overflowY: number;
}

export function placeBackground(bg: BackgroundSettings, width: number, height: number): BackgroundPlacement | null {
  if (!bg.src || !bg.naturalWidth || !bg.naturalHeight) return null;
  const cover = Math.max(width / bg.naturalWidth, height / bg.naturalHeight);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, bg.zoom));
  const w = bg.naturalWidth * cover * zoom;
  const h = bg.naturalHeight * cover * zoom;
  const overflowX = Math.max(0, w - width);
  const overflowY = Math.max(0, h - height);
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    left: -overflowX * clamp(bg.x) / 100,
    top: -overflowY * clamp(bg.y) / 100,
    width: w, height: h, overflowX, overflowY,
  };
}

/** 長辺を maxSide に縮小した data URL を作る (元が小さければそのまま) */
export async function loadAndDownscale(file: File, maxSide: number): Promise<{ src: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('image load failed')); i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return { src: canvas.toDataURL('image/jpeg', 0.9), width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
