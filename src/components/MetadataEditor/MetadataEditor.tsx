import type { SetlistMetadata } from '@core/layout.ts';
import styles from './MetadataEditor.module.css';

interface MetadataEditorProps {
  metadata: SetlistMetadata;
  onChange: (metadata: SetlistMetadata) => void;
}

export function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  return (
    <div className={styles.editor}>
      <div className={styles.field}>
        <label className={styles.label}>Event Name</label>
        <input
          className={styles.input}
          value={metadata.eventName}
          onChange={(e) => onChange({ ...metadata, eventName: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>DJ Name</label>
        <input
          className={styles.input}
          value={metadata.djName}
          onChange={(e) => onChange({ ...metadata, djName: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Date</label>
        <input
          className={styles.input}
          value={metadata.date}
          onChange={(e) => onChange({ ...metadata, date: e.target.value })}
        />
      </div>
    </div>
  );
}
