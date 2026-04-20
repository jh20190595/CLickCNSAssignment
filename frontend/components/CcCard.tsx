"use client";

import { useState } from 'react';

import styles from './CcCard.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function CcCard({
  value,
  onChange,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>
            CC — 주증상
          </span>
          <span className={styles.hint}>
            한 문장 요약 (Chief Complaint)
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? '복사됨' : 'CC 복사'}
          className={styles.copyBtn}
        >
          {copied ? "✓" : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/></svg>}
        </button>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 3일 전부터 기침과 발열"
        className={styles.input}
      />
    </section>
  );
}
