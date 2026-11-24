// Generates anonymized rekordbox-style playlist exports under samples/.
// All titles and artists are fictional so the files can live in a public repo.
// Usage: node scripts/generate-samples.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'samples');
mkdirSync(outDir, { recursive: true });

const HEADER = ['#', 'トラックタイトル', 'アーティスト', 'アルバム', 'BPM', '時間', 'ジャンル'];

const TITLES = [
  '夜明けのプリズム', 'Neon Harbor', '雨上がりのシグナル', 'Afterglow Circuit', '星屑リフレイン',
  'Glass Garden', '真夜中のパレード', 'Silver Tide', '春風エンジン', 'Lunar Drift',
  '透明なメロディ', 'Paper Planet', '夏空ダイアリー', 'Velvet Static', '始発列車',
  'Echo Valley', '花火の残響', 'Polar Bloom', '月影ステップ', 'Crystal Avenue',
];
const ARTISTS = [
  '架空ユニット', 'Sample Artist', 'ミナミノソラ', 'The Placeholders', '仮名トリオ',
  'Demo Collective', 'ひかりのこ', 'Null Signal', '東雲バンド', 'Test Pattern',
];
const GENRES = ['J-Pop', 'House', 'Electronic', 'Dance', 'Pop'];

function track(i) {
  const title = TITLES[i % TITLES.length];
  const artist = ARTISTS[(i * 3) % ARTISTS.length];
  const bpm = 120 + ((i * 7) % 60);
  const min = 3 + (i % 3);
  const sec = String((i * 13) % 60).padStart(2, '0');
  return [String(i + 1), title, artist, `${title} - Single`, String(bpm), `${min}:${sec}`, GENRES[i % GENRES.length]];
}

function toTsv(rows) {
  return [HEADER, ...rows].map((r) => r.join('\t')).join('\r\n') + '\r\n';
}

function writeUtf8(name, rows) {
  writeFileSync(join(outDir, name), toTsv(rows), 'utf8');
}

function writeUtf16le(name, rows) {
  const body = Buffer.from(toTsv(rows), 'utf16le');
  writeFileSync(join(outDir, name), Buffer.concat([Buffer.from([0xff, 0xfe]), body]));
}

// Standard set: 36 tracks (2 pages at 18 rows x 1 column, 1 page at 18 x 2).
writeUtf8('basic-36.txt', Array.from({ length: 36 }, (_, i) => track(i)));

// Edge cases: long names, remix / feat. notation, missing BPM / artist / album.
writeUtf8('edge-cases.txt', [
  ['1', 'とても長い曲名のテストケースで省略記号が正しく表示されるかを確認するためのタイトル', '長いアーティスト名の確認用ユニット feat. ゲストボーカル', 'アルバム名', '128', '4:01', 'J-Pop'],
  ['2', 'An Extremely Long English Title To Check Ellipsis Truncation Behavior (Extended Mix)', 'Very Long Artist Name & Another Collaborator', 'Album', '124', '6:12', 'House'],
  ['3', '夜明けのプリズム (架空ユニット Remix)', '架空ユニット, Sample Artist', '', '132', '3:45', 'Dance'],
  ['4', 'Silver Tide (feat. Demo Collective)', 'Null Signal', 'Silver Tide - Single', '', '3:58', ''],
  ['5', 'アーティスト名なし', '', '', '140', '2:59', 'Pop'],
  ['6', '記号を含む曲名 <&> "quote"', 'Test Pattern', 'Symbols', '150', '3:33', 'Electronic'],
  ['7', '絵文字なしの全角記号　～テスト～', 'ミナミノソラ', '', '118', '4:20', 'J-Pop'],
  ['8', 'Short', 'A', '', '100', '3:00', 'Pop'],
]);

// Large set: 120 tracks to check 3-digit numbering and page counts.
writeUtf8('large-120.txt', Array.from({ length: 120 }, (_, i) => track(i)));

// Encoding check: rekordbox exports UTF-16LE with BOM.
writeUtf16le('utf16le-10.txt', Array.from({ length: 10 }, (_, i) => track(i)));

console.log(`samples written to ${outDir}`);
