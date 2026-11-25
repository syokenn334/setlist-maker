import { Button, Modal } from '../ui/controls.tsx';
import styles from './ArtworkNoticeModal.module.css';

/** Shown before turning artwork display on (the images belong to their rights holders) */
export function ArtworkNoticeModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title="アートワークを表示する" onClose={onCancel} width={440}>
      <div className={styles.body}>
        <p>アートワークは iTunes Search API から取得します。ジャケット画像の著作権はレーベルなどの権利者にあり、Apple の利用条件では宣伝以外の目的での利用や保存は認められていません。</p>
        <p>アートワークを入れた画像を SNS などに投稿する場合は、利用者の責任で行ってください。</p>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>キャンセル</Button>
        <Button variant="primary" onClick={onConfirm}>表示する</Button>
      </div>
    </Modal>
  );
}
