"use client";

import { useState } from "react";
import type { PlanSections } from "@/lib/types";
import { PLAN_LABELS } from "@/lib/types";

interface PlanPanelProps {
  /** 4개 서브섹션 값 (controlled) */
  value: PlanSections;
  /** 한 서브섹션 편집 시 호출 */
  onChange: (field: keyof PlanSections, value: string) => void;
  /** 정의되면 각 서브카드 우상단에 "재생성" 버튼 노출. key 단위로 호출 */
  onRegenerate?: (field: keyof PlanSections) => void;
  /** 재생성 버튼을 잠시 disabled로 만들기 위한 플래그 */
  regenerateDisabled?: boolean;
  /** 헤더 "복사" 버튼 — 전체 Plan을 한 문자열로 복사 */
  onCopyAll?: () => void;
}

const HINTS: Record<keyof PlanSections, string> = {
  medication: "약물명 · 용량 · 용법",
  exam: "랩 · 영상 · 추가 검사",
  education: "생활습관 · 주의사항",
  followup: "재방문 · 리퍼 · 경과 관찰",
};

/** P-약물(노랑) · P-검사(하늘) · P-교육(로즈) · P-추후(보라). 몸체는 흰색, 좌측 바 + 은은한 헤더 틴트로 구분 */
const ACCENTS: Record<
  keyof PlanSections,
  { bar: string; header: string }
> = {
  medication: {
    bar: "border-l-amber-400 dark:border-l-amber-500",
    header: "bg-amber-50 dark:bg-amber-950/30",
  },
  exam: {
    bar: "border-l-sky-400 dark:border-l-sky-500",
    header: "bg-sky-50 dark:bg-sky-950/30",
  },
  education: {
    bar: "border-l-rose-400 dark:border-l-rose-500",
    header: "bg-rose-50 dark:bg-rose-950/30",
  },
  followup: {
    bar: "border-l-violet-400 dark:border-l-violet-500",
    header: "bg-violet-50 dark:bg-violet-950/30",
  },
};

const FIELDS: Array<keyof PlanSections> = [
  "medication",
  "exam",
  "education",
  "followup",
];

export function PlanPanel({
  value,
  onChange,
  onRegenerate,
  regenerateDisabled,
  onCopyAll,
}: PlanPanelProps) {
  const [copiedAll, setCopiedAll] = useState(false);

  async function handleCopyAll() {
    if (onCopyAll) {
      onCopyAll();
    } else {
      const text = FIELDS.map((k) =>
        value[k]?.trim() ? `[${PLAN_LABELS[k]}]\n${value[k].trim()}` : "",
      )
        .filter(Boolean)
        .join("\n\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore */
      }
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1200);
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden dark:bg-slate-900 dark:border-slate-700">
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
        <div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">P — Plan</span>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            계획을 4개 서브섹션으로 분할
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          title={copiedAll ? "복사됨" : "Plan 전체 복사"}
          className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {copiedAll ? "복사됨" : "복사"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
        {FIELDS.map((key) => {
          const accent = ACCENTS[key];
          return (
            <div
              key={key}
              className={`flex flex-col min-h-44 bg-white border-l-4 dark:bg-slate-900 ${accent.bar}`}
            >
              <div
                className={`flex items-center justify-between px-3 py-1.5 ${accent.header}`}
              >
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {PLAN_LABELS[key]}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {HINTS[key]}
                  </span>
                </div>
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={() => onRegenerate(key)}
                    disabled={regenerateDisabled}
                    title="이 서브섹션 재생성"
                    className="text-[11px] text-sky-600 hover:text-sky-800 disabled:text-slate-300 dark:text-sky-400 dark:hover:text-sky-300 dark:disabled:text-slate-600"
                  >
                    재생성
                  </button>
                )}
              </div>
              <textarea
                value={value[key]}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={HINTS[key]}
                className="flex-1 w-full px-3 py-2 text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
