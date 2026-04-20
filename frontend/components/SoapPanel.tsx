"use client";

import { useState } from "react";
import styles from "./SoapPanel.module.css";

export type SoapAccent = "s" | "o" | "a";

interface SoapPanelProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onRegenerate?: () => void;
  accent?: SoapAccent;
}

const ACCENT_CLASSES: Record<
  SoapAccent,
  {
    card: string;
    header: string;
    label: string;
    hint: string;
  }
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

export function SoapPanel({
  label,
  hint,
  value,
  onChange,
  onRegenerate,
  accent,
}: SoapPanelProps) {
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
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable */
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
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "복사됨" : "섹션 복사"}
            className={styles.copyBtn}
          >
            {copied ? "복사됨" : "복사"}
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              title="이 섹션 재생성"
              className={styles.regenBtn}
            >
              재생성
            </button>
          )}
        </div>
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
