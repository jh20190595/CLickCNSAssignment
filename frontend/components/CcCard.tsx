"use client";

import { useState } from "react";
import styles from "./CcCard.module.css";

interface CcCardProps {
  value: string;
  onChange: (v: string) => void;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
}

export function CcCard({
  value,
  onChange,
  onRegenerate,
  regenerateDisabled,
}: CcCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
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
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "복사됨" : "CC 복사"}
            className={styles.copyBtn}
          >
            {copied ? "복사됨" : "복사"}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerateDisabled}
              className={styles.regenBtn}
            >
              재생성
            </button>
          )}
        </div>
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
