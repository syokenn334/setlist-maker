/**
 * 出力プリセット (docs/design-system.md 2.2 / 実装計画 1.6)
 *
 * - width / height は論理サイズ (レイアウト計算の単位)。PNG の実寸は x exportScale
 * - safeX / safeY はセーフマージン: 放送の action safe (各軸 3.5%、EBU R 95) を 8 の倍数に切り上げ。
 *   1:1 は Instagram のプロフィール一覧 (3:4) で左右が 12.5% 欠けるため左右 16%
 */

export type PresetId = '16:9' | '4:5' | '1:1' | '3:4';

export interface CanvasPreset {
  id: PresetId;
  width: number;
  height: number;
  safeX: number;
  safeY: number;
  /** 選べるカラム数 (2 カラムは横長のみ) */
  columns: readonly (1 | 2)[];
  /** PNG の書き出し倍率 */
  exportScale: number;
  /** 複数ページを X のカルーセルで投稿すると左右が切り抜かれる可能性がある */
  croppedInXCarousel: boolean;
}

export const PRESETS: Record<PresetId, CanvasPreset> = {
  '16:9': { id: '16:9', width: 1600, height: 900, safeX: 56, safeY: 32, columns: [1, 2], exportScale: 2, croppedInXCarousel: true },
  '4:5': { id: '4:5', width: 1080, height: 1350, safeX: 40, safeY: 48, columns: [1], exportScale: 1, croppedInXCarousel: false },
  '1:1': { id: '1:1', width: 1080, height: 1080, safeX: 176, safeY: 40, columns: [1], exportScale: 1, croppedInXCarousel: false },
  '3:4': { id: '3:4', width: 1080, height: 1440, safeX: 40, safeY: 56, columns: [1], exportScale: 1, croppedInXCarousel: false },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** X / Instagram とも 1 投稿 20 枚まで */
export const MAX_IMAGES_PER_POST = 20;
