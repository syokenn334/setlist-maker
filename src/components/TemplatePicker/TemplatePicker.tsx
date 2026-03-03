import type { SetlistTemplate } from '../../templates/index.ts';
import { templates } from '../../templates/index.ts';
import styles from './TemplatePicker.module.css';

interface TemplatePickerProps {
  current: SetlistTemplate;
  onChange: (template: SetlistTemplate) => void;
}

export function TemplatePicker({ current, onChange }: TemplatePickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.label}>Template</div>
      <div className={styles.options}>
        {templates.map((t) => (
          <button
            key={t.id}
            className={`${styles.option} ${t.id === current.id ? styles.active : ''}`}
            onClick={() => onChange(t)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
