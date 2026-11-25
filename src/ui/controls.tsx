/**
 * Shared UI controls (Figma section 7 / 8). Values come from styles/tokens.css only.
 */
import { useEffect, useId } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, X } from './icons.tsx';
import styles from './controls.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({ variant = 'secondary', block, external, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean; external?: boolean }) {
  return (
    <button type="button" className={`${styles.button} ${styles[variant]} ${block ? styles.block : ''} ${className ?? ''}`} {...rest}>
      {children}
      {external && <ExternalLink size={14} className={styles.trailingIcon} />}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={`${styles.iconButton} ${className ?? ''}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export interface SegmentOption<T extends string | number> { value: T; label: string; disabled?: boolean }

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          className={`${styles.segment} ${o.value === value ? styles.segmentActive : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ label, value, onChange, type = 'text', autoComplete, placeholder, trailing }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; placeholder?: string; trailing?: ReactNode }) {
  return (
    <Field label={label}>
      <span className={styles.inputWrap}>
        <input className={styles.input} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
        {trailing}
      </span>
    </Field>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, disabled }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; disabled?: boolean }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`${styles.slider} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.sliderHead}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <span className={styles.label}>{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--fill-ratio': pct / 100 } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section}>
      <button type="button" className={styles.sectionHead} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div id={id} className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.switchRow}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} className={`${styles.switch} ${checked ? styles.switchOn : ''}`} onClick={() => onChange(!checked)}>
        <span className={styles.switchKnob} />
      </button>
    </label>
  );
}

export function Chip({ selected, children, onClick }: { selected?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" aria-pressed={selected} className={`${styles.chip} ${selected ? styles.chipSelected : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/** Modal (desktop) / bottom sheet or full screen (mobile, via CSS). Closes on Escape and backdrop click. */
export function Modal({ title, onClose, children, width = 560, header }: { title?: string; onClose: () => void; children: ReactNode; width?: number; header?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.modal}
        style={{ '--modal-width': `${width}px` } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || header) && (
          <div className={styles.modalHead}>
            {header ?? <h2 className={styles.modalTitle}>{title}</h2>}
            <IconButton label="閉じる" onClick={onClose}><X /></IconButton>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div className={styles.toast} role="status">
      <span className={styles.dot} aria-hidden="true" />
      <span>{message}</span>
      <IconButton label="閉じる" onClick={onClose}><X size={14} /></IconButton>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className={styles.errorText} role="alert">
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </p>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={styles.progressBar} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

/** Radix Themes Spinner: 8 leaves fading in turn (800ms), drawn in the current text colour at 65% opacity */
export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className={styles.spinner} style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: 8 }, (_, i) => <span key={i} className={styles.spinnerLeaf} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${((i - 8) / 8) * 800}ms` }} />)}
    </span>
  );
}

/** Radix Themes Checkbox (size 2, variant surface) with its label */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.checkboxRow}>
      <button type="button" role="checkbox" aria-checked={checked} className={`${styles.checkbox} ${checked ? styles.checkboxOn : ''}`} onClick={() => onChange(!checked)}>
        {checked && <Check size={12} strokeWidth={3} />}
      </button>
      <span>{label}</span>
    </label>
  );
}
