"use client";

import { useState } from 'react';

import styles from './SoapPanel.module.css';

export type SoapAccent = 's' | 'o' | 'a';

interface Props {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  accent?: SoapAccent;
}

const ACCENT_CLASSES: Record<
  SoapAccent,
  { card: string; header: string; label: string; hint: string }
> = {
  s: {
    card: styles.cardS,
    header: styles.headerS,
    label: styles.labelS,
    hint: styles.hintS,
  },
  o: {
    card: styles.cardO,
    header: styles.headerO,
    label: styles.labelO,
    hint: styles.hintO,
  },
  a: {
    card: styles.cardA,
    header: styles.headerA,
    label: styles.labelA,
    hint: styles.hintA,
  },
};

export default function SoapPanel({
  label,
  hint,
  value,
  onChange,
  accent,
}: Props) {
  const [copied, setCopied] = useState(false);

  const accentStyles = accent
    ? ACCENT_CLASSES[accent]
    : {
        card: styles.cardDefault,
        header: styles.headerDefault,
        label: styles.labelDefault,
        hint: styles.hintDefault,
      };

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
    }
  }

  return (
    <div
      className={`${styles.card} ${accentStyles.card}`}
    >
      <div
        className={`${styles.header} ${accentStyles.header}`}
      >
        <div>
          <span className={`${styles.label} ${accentStyles.label}`}>{label}</span>
          <span className={`${styles.hint} ${accentStyles.hint}`}>{hint}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? '복사됨' : '섹션 복사'}
          className={styles.copyBtn}
        >
          {copied ? "✓" : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/></svg>}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="내용을 입력하거나 편집하세요"
        className={styles.textarea}
      />
    </div>
  );
}
