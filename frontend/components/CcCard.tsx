"use client";

import { useState } from "react";

interface CcCardProps {
  /** CC 텍스트 (controlled) */
  value: string;
  /** 편집 시 호출 */
  onChange: (v: string) => void;
  /** 정의되면 우상단 "재생성" 버튼 렌더 */
  onRegenerate?: () => void;
  /** 재생성 버튼 비활성 여부 (분류 중) */
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
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl overflow-hidden dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700">
      <div className="px-4 py-2 border-b border-blue-200 bg-white/40 flex items-center justify-between dark:border-blue-800 dark:bg-slate-900/40">
        <div>
          <span className="text-sm font-bold text-blue-900 tracking-tight dark:text-blue-200">
            CC — 주증상
          </span>
          <span className="ml-2 text-xs text-blue-700/80 dark:text-blue-400/80">
            한 문장 요약 (Chief Complaint)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "복사됨" : "CC 복사"}
            className="text-xs text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
          >
            {copied ? "복사됨" : "복사"}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerateDisabled}
              className="text-xs text-sky-700 hover:text-sky-900 disabled:text-slate-300 dark:text-sky-400 dark:hover:text-sky-300 dark:disabled:text-slate-600"
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
        className="w-full px-4 py-3 bg-transparent text-lg font-medium text-blue-950 placeholder:text-blue-400 focus:outline-none dark:text-blue-100 dark:placeholder:text-blue-600"
      />
    </section>
  );
}
