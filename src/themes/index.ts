/**
 * 生成画像のテーマ (docs/design-system.md 2.5.1。Figma の変数コレクション「setlist / image」と同じ値)
 *
 * 色は Radix Colors 3.0.0 のスケールから選ぶ。役割は 5 つ:
 * - bg: 背景 / surface: ジャケットの代わり・伏せ字 / textPrimary: 曲名・イベント名
 * - textSecondary: アーティスト名・曲番号・日付など / accent: 区切り線と BPM
 */

export type ThemeId = 'dark' | 'light' | 'mono' | 'midnight' | 'warm';

export interface ImageTheme {
  id: ThemeId;
  name: string;
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
}

export const THEMES: ImageTheme[] = [
  // gray-dark 1 / 3 / 12 / 11, ruby-dark 9
  { id: 'dark', name: 'Dark', bg: '#111111', surface: '#222222', textPrimary: '#eeeeee', textSecondary: '#b4b4b4', accent: '#e54666' },
  // gray 1 / 3 / 12 / 11, ruby 11
  { id: 'light', name: 'Light', bg: '#fcfcfc', surface: '#f0f0f0', textPrimary: '#202020', textSecondary: '#646464', accent: '#ca244d' },
  // gray 1 / 4 / 12 / 11 / 12
  { id: 'mono', name: 'Mono', bg: '#fcfcfc', surface: '#e8e8e8', textPrimary: '#202020', textSecondary: '#646464', accent: '#202020' },
  // indigo-dark 1 / 3, slate-dark 12 / 11, indigo-dark 11
  { id: 'midnight', name: 'Midnight', bg: '#11131f', surface: '#182449', textPrimary: '#edeef0', textSecondary: '#b0b4ba', accent: '#9eb1ff' },
  // sand 2 / 4 / 12 / 11, tomato 11
  { id: 'warm', name: 'Warm', bg: '#f9f9f8', surface: '#e9e8e6', textPrimary: '#21201c', textSecondary: '#63635e', accent: '#d13415' },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: ThemeId): ImageTheme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}
