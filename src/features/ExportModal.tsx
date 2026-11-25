import { useRef, useState } from 'react';
import type { PageSlice } from '../core/pagination.ts';
import type { SetlistImageProps } from '../image/SetlistImage.tsx';
import { SetlistImage } from '../image/SetlistImage.tsx';
import { canShareFiles, captureImage, downloadBlob, extensionOf, fitFileSize, safeFileName, shareFiles, zipBlobs } from '../core/exportImage.ts';
import { MAX_IMAGES_PER_POST } from '../core/presets.ts';
import { Button, ErrorText, Modal, Progress, Segmented } from '../ui/controls.tsx';
import { Check, Link, Share } from '../ui/icons.tsx';
import { Scaled } from './Scaled.tsx';
import styles from './ExportModal.module.css';

type ImageBase = Omit<SetlistImageProps, 'slice' | 'pageIndex' | 'pageCount' | 'substitutes' | 'onTrackClick'>;
type Delivery = 'zip' | 'each' | 'share';
type Step = { kind: 'select' } | { kind: 'exporting'; done: number } | { kind: 'done'; files: File[] } | { kind: 'error'; message: string };

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

export function ExportModal({ slices, imageProps, baseName, shareUrl, onClose }: { slices: PageSlice[]; imageProps: ImageBase; baseName: string; shareUrl: string; onClose: () => void }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied('ok'); } catch { setCopied('failed'); }
  };
  const shareSupported = canShareFiles([new File([''], 'probe.png', { type: 'image/png' })]);
  const [delivery, setDelivery] = useState<Delivery>(isMobile() && shareSupported ? 'share' : 'zip');
  const [step, setStep] = useState<Step>({ kind: 'select' });
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cancelled = useRef(false);
  const { preset } = imageProps;
  const name = safeFileName(baseName);
  const fileName = (i: number, ext: string) => (slices.length > 1 ? `${name}_${i + 1}.${ext}` : `${name}.${ext}`);

  const start = async () => {
    cancelled.current = false;
    setStep({ kind: 'exporting', done: 0 });
    // let React mount the offscreen pages first
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const files: File[] = [];
      for (let i = 0; i < slices.length; i++) {
        if (cancelled.current) return;
        const el = pageRefs.current[i];
        if (!el) continue;
        const blob = await fitFileSize(await captureImage(el, { width: preset.width, height: preset.height, scale: preset.exportScale }));
        files.push(new File([blob], fileName(i, extensionOf(blob)), { type: blob.type }));
        setStep({ kind: 'exporting', done: i + 1 });
      }
      if (cancelled.current) return;
      setStep({ kind: 'done', files });
      if (delivery === 'zip' || (delivery !== 'share' && files.length === 1)) {
        if (files.length === 1) downloadBlob(files[0], files[0].name);
        else downloadBlob(await zipBlobs(files.map((f) => ({ name: f.name, blob: f }))), `${name}.zip`);
      }
    } catch {
      setStep({ kind: 'error', message: '書き出しに失敗しました' });
    }
  };

  const cancel = () => { cancelled.current = true; setStep({ kind: 'select' }); };

  const thumbScale = Math.min(160 / preset.width, 120 / preset.height);
  const tooMany = slices.length > MAX_IMAGES_PER_POST;

  return (
    <Modal title="Export" onClose={onClose} width={600}>
      <ul className={styles.pages}>
        {slices.map((slice, i) => (
          <li key={i} className={styles.page}>
            <Scaled width={preset.width} height={preset.height} scale={thumbScale} className={styles.thumb}>
              <SetlistImage {...imageProps} slice={slice} pageIndex={i} pageCount={slices.length} />
            </Scaled>
            <span className={styles.pageLabel}>{step.kind === 'done' && <Check size={12} />}{i + 1}</span>
          </li>
        ))}
      </ul>
      <p className={styles.spec}>{`${preset.id} ・ ${preset.width * preset.exportScale} x ${preset.height * preset.exportScale} ・ PNG ・ ${slices.length} 枚`}</p>
      {tooMany && <ErrorText>{`1 投稿に載せられるのは ${MAX_IMAGES_PER_POST} 枚までです`}</ErrorText>}

      {step.kind !== 'done' && (
        <div className={step.kind === 'exporting' ? styles.dim : ''}>
          <Segmented<Delivery>
            label="受け取り方"
            value={delivery}
            onChange={setDelivery}
            options={[{ value: 'zip', label: 'ZIP' }, { value: 'each', label: '1 枚ずつ' }, { value: 'share', label: '共有', disabled: !shareSupported }]}
          />
        </div>
      )}

      {step.kind === 'select' && <Button variant="primary" block onClick={start}><Share />Export</Button>}
      {step.kind === 'select' && (
        <div className={styles.shareLink}>
          <span className={styles.shareLabel}>共有ページ</span>
          <Button variant="ghost" onClick={() => void copyLink()}>{copied === 'ok' ? <Check /> : <Link />}{copied === 'ok' ? 'コピーしました' : 'リンクをコピー'}</Button>
        </div>
      )}
      {copied === 'failed' && <input className={styles.shareUrl} readOnly value={shareUrl} aria-label="共有ページのリンク" onFocus={(e) => e.currentTarget.select()} />}
      {step.kind === 'exporting' && (
        <div className={styles.progressRow}>
          <div className={styles.progress}><Progress value={step.done} max={slices.length} /></div>
          <span className={styles.count}>{step.done} / {slices.length}</span>
          <Button variant="ghost" onClick={cancel}>中止</Button>
        </div>
      )}
      {step.kind === 'done' && (
        <div className={styles.actions}>
          {delivery === 'share' && <Button variant="primary" block onClick={() => void shareFiles(step.files, baseName).catch(() => undefined)}>共有する</Button>}
          {delivery === 'each' && step.files.length > 1 && (
            <div className={styles.each}>
              {step.files.map((f, i) => <Button key={f.name} variant="secondary" onClick={() => downloadBlob(f, f.name)}>{i + 1}</Button>)}
            </div>
          )}
          {delivery === 'zip' && step.files.length > 1 && (
            <Button variant="ghost" block onClick={async () => downloadBlob(await zipBlobs(step.files.map((f) => ({ name: f.name, blob: f }))), `${name}.zip`)}>もう一度ダウンロード</Button>
          )}
          <Button variant="secondary" block onClick={onClose}>閉じる</Button>
        </div>
      )}
      {step.kind === 'error' && <><ErrorText>{step.message}</ErrorText><Button variant="secondary" block onClick={() => setStep({ kind: 'select' })}>戻る</Button></>}

      {step.kind === 'exporting' && (
        <div className={styles.offscreen} aria-hidden="true">
          {slices.map((slice, i) => (
            <div key={i} ref={(el) => { pageRefs.current[i] = el; }}>
              <SetlistImage {...imageProps} slice={slice} pageIndex={i} pageCount={slices.length} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
