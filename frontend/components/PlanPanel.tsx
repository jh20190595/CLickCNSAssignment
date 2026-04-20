"use client";

import { useState } from 'react';

import type { PlanSections } from '@/lib/types';
import { PLAN_LABELS } from '@/lib/types';

import styles from './PlanPanel.module.css';

interface Props {
  value: PlanSections;
  onChange: (field: keyof PlanSections, value: string) => void;
  onCopyAll?: () => void;
}

const HINTS: Record<keyof PlanSections, string> = {
  medication: '약물명 · 용량 · 용법',
  exam: '랩 · 영상 · 추가 검사',
  education: '생활습관 · 주의사항',
  followup: '재방문 · 리퍼 · 경과 관찰',
};

const ACCENTS: Record<
  keyof PlanSections,
  { bar: string; header: string }
> = {
  medication: {
    bar: styles.barMedication,
    header: styles.headerMedication,
  },
  exam: {
    bar: styles.barExam,
    header: styles.headerExam,
  },
  education: {
    bar: styles.barEducation,
    header: styles.headerEducation,
  },
  followup: {
    bar: styles.barFollowup,
    header: styles.headerFollowup,
  },
};

const FIELDS: Array<keyof PlanSections> = [
  'medication',
  'exam',
  'education',
  'followup',
];

export default function PlanPanel({
  value,
  onChange,
  onCopyAll,
}: Props) {
  const [copiedAll, setCopiedAll] = useState(false);

  async function handleCopyAll() {
    if (onCopyAll) {
      onCopyAll();
    } else {
      const text = FIELDS.map((k) =>
        value[k]?.trim() ? `[${PLAN_LABELS[k]}]\n${value[k].trim()}` : '',
      )
        .filter(Boolean)
        .join('\n\n');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
      }
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1200);
  }

  return (
    <section className={styles.section}>
      <div className={styles.mainHeader}>
        <div>
          <span className={styles.mainLabel}>P — Plan</span>
          <span className={styles.mainHint}>
            계획을 4개 서브섹션으로 분할
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          title={copiedAll ? '복사됨' : 'Plan 전체 복사'}
          className={styles.copyAllBtn}
        >
          {copiedAll ? "✓" : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/></svg>}
        </button>
      </div>
      <div className={styles.grid}>
        {FIELDS.map((key) => {
          const accent = ACCENTS[key];
          return (
            <div
              key={key}
              className={`${styles.subCard} ${accent.bar}`}
            >
              <div
                className={`${styles.subHeader} ${accent.header}`}
              >
                <div>
                  <span className={styles.subLabel}>
                    {PLAN_LABELS[key]}
                  </span>
                  <span className={styles.subHint}>
                    {HINTS[key]}
                  </span>
                </div>
              </div>
              <textarea
                value={value[key]}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={HINTS[key]}
                className={styles.textarea}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
