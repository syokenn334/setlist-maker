import { useState } from 'react';
import type { TrackWithArtwork } from '../../types/index.ts';
import type { PlaylistState } from './types.ts';
import { INITIAL_PLAYLIST } from './types.ts';
import { CREDENTIALS_URL, addToPlaylist, createPlaylist, getChannelTitle, judge, playlistUrl, requestToken, revokeToken, searchVideos, YouTubeError } from './youtube.ts';
import { Button, ErrorText, IconButton, Progress, Segmented, Switch, TextInput, Spinner } from '../../ui/controls.tsx';
import { Eye, EyeOff } from '../../ui/icons.tsx';
import styles from './Playlist.module.css';

type Update = (updater: (p: PlaylistState) => PlaylistState) => void;

function SecretInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <TextInput
      label={label}
      value={value}
      onChange={onChange}
      type={shown ? 'text' : 'password'}
      autoComplete="off"
      trailing={<IconButton label={shown ? '隠す' : '表示する'} onClick={() => setShown((v) => !v)}>{shown ? <EyeOff size={14} /> : <Eye size={14} />}</IconButton>}
    />
  );
}

export function PlaylistSection({ state: s, onChange, tracks, hidden, eventName, date, onOpenReview }: {
  state: PlaylistState;
  onChange: Update;
  tracks: TrackWithArtwork[];
  hidden: ReadonlySet<number>;
  eventName: string;
  date: string;
  onOpenReview: () => void;
}) {
  const targets = tracks.map((_, i) => i).filter((i) => !hidden.has(i));
  const fail = (e: unknown) => onChange((p) => ({ ...p, error: e instanceof Error ? e.message : 'エラーが発生しました' }));

  const login = async () => {
    onChange((p) => ({ ...p, error: null }));
    try {
      const token = await requestToken(s.clientId.trim());
      let account: string | null = null;
      try { account = await getChannelTitle(token, s.apiKey.trim()); } catch { /* channel may not exist yet */ }
      onChange((p) => ({ ...p, accessToken: token, account, step: 'signedIn', name: p.name || `${eventName} ${date}`.trim() }));
    } catch (e) { fail(e); }
  };

  const logout = async () => {
    if (s.accessToken) await revokeToken(s.accessToken).catch(() => undefined);
    // Forget everything (credentials included). Keep the created playlist URL so the QR stays.
    onChange((p) => ({ ...INITIAL_PLAYLIST, createdUrl: p.createdUrl, qrEnabled: p.qrEnabled, qrOnAllPages: p.qrOnAllPages }));
  };

  const search = async () => {
    const token = s.accessToken!, key = s.apiKey.trim();
    onChange((p) => ({ ...p, step: 'searching', progress: 0, matches: [], error: null }));
    const matches: PlaylistState['matches'] = [];
    try {
      for (let n = 0; n < targets.length; n++) {
        const i = targets[n], t = tracks[i];
        const candidates = await searchVideos(`${t.artist ?? ''} ${t.title ?? ''}`.trim(), token, key);
        matches.push({ index: i, candidates, selected: candidates[0] ?? null, status: judge(t, candidates[0]) });
        onChange((p) => ({ ...p, progress: n + 1, matches: [...matches] }));
      }
      onChange((p) => ({ ...p, step: 'review' }));
    } catch (e) {
      onChange((p) => ({ ...p, step: matches.length ? 'review' : 'signedIn', error: e instanceof YouTubeError || e instanceof Error ? e.message : 'エラー' }));
    }
  };

  const create = async () => {
    const token = s.accessToken!, key = s.apiKey.trim();
    const videos = s.matches.filter((m) => m.selected).map((m) => m.selected!.videoId);
    onChange((p) => ({ ...p, step: 'creating', progress: 0, error: null }));
    try {
      const id = await createPlaylist(s.name.trim() || `${eventName} ${date}`, s.privacy, token, key);
      for (let n = 0; n < videos.length; n++) {
        await addToPlaylist(id, videos[n], token, key);
        onChange((p) => ({ ...p, progress: n + 1 }));
      }
      onChange((p) => ({ ...p, step: 'done', createdUrl: playlistUrl(id) }));
    } catch (e) {
      onChange((p) => ({ ...p, step: 'review', error: `${e instanceof Error ? e.message : 'エラー'}（作成済みの分は YouTube に残っています）` }));
    }
  };

  const counts = { ok: 0, review: 0, none: 0 };
  for (const m of s.matches) counts[m.status]++;

  return (
    <div className={styles.section}>
      {s.step === 'credentials' && (
        <>
          <p className={styles.note}>QR の生成には YouTube の API キーが必要です</p>
          <Button variant="ghost" block external onClick={() => window.open(CREDENTIALS_URL, '_blank', 'noopener,noreferrer')}>API キーを発行</Button>
          <SecretInput label="クライアント ID" value={s.clientId} onChange={(v) => onChange((p) => ({ ...p, clientId: v }))} />
          <SecretInput label="API キー" value={s.apiKey} onChange={(v) => onChange((p) => ({ ...p, apiKey: v }))} />
          <Button variant="secondary" block external disabled={!s.clientId.trim() || !s.apiKey.trim()} onClick={() => void login()}>Google でログイン</Button>
        </>
      )}

      {s.step !== 'credentials' && (
        <div className={styles.account}>
          <span className={styles.accountName}>{s.account ?? 'ログイン中'}</span>
          <Button variant="ghost" onClick={() => void logout()}>ログアウト</Button>
        </div>
      )}

      {s.step === 'signedIn' && (
        <>
          <TextInput label="プレイリスト名" value={s.name} onChange={(v) => onChange((p) => ({ ...p, name: v }))} />
          <div className={styles.group}>
            <span className={styles.label}>公開範囲</span>
            <Segmented label="公開範囲" value={s.privacy} onChange={(v) => onChange((p) => ({ ...p, privacy: v }))} options={[{ value: 'unlisted', label: '限定公開' }, { value: 'public', label: '公開' }]} />
          </div>
          <Button variant="secondary" block disabled={targets.length === 0} onClick={() => void search()}>{targets.length} 曲を検索</Button>
          <p className={styles.note}>検索は 1 日 100 回まで</p>
        </>
      )}

      {(s.step === 'searching' || s.step === 'creating') && (
        <div className={styles.group}>
          <span className={`${styles.label} ${styles.busy}`}><Spinner />{s.step === 'searching' ? '検索中' : '作成中'}</span>
          <Progress value={s.progress} max={s.step === 'searching' ? targets.length : s.matches.filter((m) => m.selected).length} />
        </div>
      )}

      {s.step === 'review' && (
        <>
          <div className={styles.counts}>
            <span><strong>{counts.ok}</strong>一致</span>
            <span><strong>{counts.review}</strong>要確認</span>
            <span><strong>{counts.none}</strong>なし</span>
          </div>
          <Button variant="ghost" block onClick={onOpenReview}>照合結果を見る</Button>
          <Button variant="primary" block disabled={!s.matches.some((m) => m.selected)} onClick={() => void create()}>プレイリストを作成</Button>
        </>
      )}

      {s.step === 'done' && s.createdUrl && (
        <>
          <Button variant="ghost" block external onClick={() => window.open(s.createdUrl!, '_blank', 'noopener,noreferrer')}>YouTube で開く</Button>
          <Switch label="QR を入れる" checked={s.qrEnabled} onChange={(v) => onChange((p) => ({ ...p, qrEnabled: v }))} />
          <div className={styles.group}>
            <span className={styles.label}>入れるページ</span>
            <Segmented label="QR を入れるページ" value={s.qrOnAllPages ? 'all' : 'last'} onChange={(v) => onChange((p) => ({ ...p, qrOnAllPages: v === 'all' }))} options={[{ value: 'last', label: '最後' }, { value: 'all', label: 'すべて' }]} />
          </div>
        </>
      )}

      {s.error && <ErrorText>{s.error}</ErrorText>}
    </div>
  );
}
