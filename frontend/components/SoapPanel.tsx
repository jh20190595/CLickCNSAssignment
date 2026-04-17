"use client";

import { useState } from "react";

export type SoapAccent = "s" | "o" | "a";

interface SoapPanelProps {
  /** 섹션 타이틀 (예: "S — Subjective") */
  label: string;
  /** 타이틀 옆 회색 설명 문구 */
  hint: string;
  /** textarea 값 (controlled) */
  value: string;
  /** textarea 입력 시 호출 */
  onChange: (v: string) => void;
  /** 정의되면 우상단 "재생성" 버튼 렌더 — 현재는 S 섹션만 전달 */
  onRegenerate?: () => void;
  /** 색상 테마. S=초록, O=보라, A=분홍(강조). 미지정이면 기본 slate */
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
    card: "border-emerald-200 dark:border-emerald-800",
    header: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900",
    label: "text-emerald-800 dark:text-emerald-300",
    hint: "text-emerald-700/70 dark:text-emerald-400/70",
  },
  o: {
    card: "border-violet-200 dark:border-violet-800",
    header: "bg-violet-50 border-violet-100 dark:bg-violet-950/30 dark:border-violet-900",
    label: "text-violet-800 dark:text-violet-300",
    hint: "text-violet-700/70 dark:text-violet-400/70",
  },
  a: {
    card: "border-pink-300 border-l-4 border-l-pink-500 shadow-sm dark:border-pink-800 dark:border-l-pink-500",
    header: "bg-pink-50 border-pink-100 dark:bg-pink-950/30 dark:border-pink-900",
    label: "text-pink-900 font-bold dark:text-pink-300",
    hint: "text-pink-700/80 dark:text-pink-400/80",
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
  const styles = accent
    ? ACCENT_CLASSES[accent]
    : {
        card: "border-slate-200 dark:border-slate-700",
        header: "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700",
        label: "text-slate-800 dark:text-slate-100",
        hint: "text-slate-500 dark:text-slate-400",
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
      className={`bg-white border rounded-xl overflow-hidden flex flex-col min-h-56 dark:bg-slate-900 ${styles.card}`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2 border-b ${styles.header}`}
      >
        <div>
          <span className={`text-sm font-semibold ${styles.label}`}>{label}</span>
          <span className={`ml-2 text-xs ${styles.hint}`}>{hint}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "복사됨" : "섹션 복사"}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors dark:text-slate-400 dark:hover:text-slate-200"
          >
            {copied ? "복사됨" : "복사"}
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              title="이 섹션 재생성"
              className="text-xs text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
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
        className="flex-1 w-full px-4 py-3 text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600"
      />
    </div>
  );
}
