/** Test board for the renderer comparison (dev only). See renderers.tsx. */
export const WIDTH = 1080;
export const HEIGHT = 1350;

/** Blocky stand-in photo (no network). */
function makePhoto(w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < h; y += 40) {
    for (let x = 0; x < w; x += 40) {
      ctx.fillStyle = `hsl(${(x * 0.7 + y * 0.3) % 360} 70% ${35 + ((x + y) % 30)}%)`;
      ctx.fillRect(x, y, 40, 40);
    }
  }
  return c.toDataURL('image/png');
}

const photo = makePhoto(640, 400);
const tallArt = makePhoto(120, 240);

const font = "'Inter', 'Noto Sans JP', sans-serif";

export function Board() {
  return (
    <div
      id="board"
      style={{
        position: 'relative', width: WIDTH, height: HEIGHT, overflow: 'hidden',
        fontFamily: font, color: '#eee', background: '#111',
      }}
    >
      {/* 1. Background with CSS filter + position/size */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${photo}")`, backgroundSize: '160%', backgroundPosition: '30% 70%',
          filter: 'saturate(0.2) brightness(0.6) blur(6px)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,17,17,0.5)' }} />

      <div style={{ position: 'relative', padding: 64, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* 2. Japanese web font, weights */}
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>夜明けのプリズム Live 2026</div>
        <div style={{ fontSize: 28, fontWeight: 400, color: '#aaa' }}>DJ サンプル ・ 2026.11.24 ・ 渋谷</div>

        {/* 3. Rows: object-fit art, ellipsis, box-shadow card */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 24, height: 120, padding: '0 24px',
              background: 'rgba(255,255,255,0.06)', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ width: 32, fontSize: 28, color: '#888', textAlign: 'right' }}>{i + 1}</div>
            <img src={tallArt} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i === 0 ? 'とても長い曲名のテストケースで省略記号が正しく表示されるかを確認するためのタイトル' : `曲名サンプル ${i + 1} (Extended Mix)`}
              </div>
              <div style={{ fontSize: 24, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                架空ユニット feat. ゲストボーカル
              </div>
            </div>
            <div style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums', color: '#e94560' }}>{128 + i}</div>
          </div>
        ))}

        {/* 4. Mix-blend-mode and a semi-transparent border */}
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ width: 200, height: 120, background: '#e94560', mixBlendMode: 'screen', borderRadius: 12 }} />
          <div style={{ width: 200, height: 120, border: '4px solid rgba(255,255,255,0.3)', borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
