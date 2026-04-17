"use client";

import { useEffect, useRef } from "react";

interface RecordingIndicatorProps {
  /** true면 키보드 타이핑 감지로 오디오 전송이 일시 멈춘 상태 (주황 점) */
  isPaused: boolean;
  /** useStt의 SttStatus 문자열 — "connecting" | "recording" | "processing" | "error" 등에 따라 분기 렌더 */
  status: string;
  /** status === "error"일 때 노출할 메시지. null이면 기본 문구 */
  error: string | null;
  /** 확정된 문장 세그먼트 배열 (transcript_final 누적) */
  finalTexts: string[];
  /** 인식 중인 미확정 텍스트. 회색 이탤릭으로 표시 */
  partialText: string;
}

export function RecordingIndicator({
  isPaused,
  status,
  error,
  finalTexts,
  partialText,
}: RecordingIndicatorProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [finalTexts.length, partialText]);

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-8 select-none min-h-0">
      {status === "connecting" && (
        <p className="text-slate-500 dark:text-slate-400 text-sm">마이크 준비 중...</p>
      )}
      {status === "recording" && (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              {isPaused ? "일시정지 (타이핑 감지)" : "녹음 중"}
            </span>
          </div>
          <div className="mt-6 w-full max-w-2xl flex-1 overflow-y-auto text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-1">
            {finalTexts.length === 0 && !partialText && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                환자와의 대화에 집중하세요
              </p>
            )}
            {finalTexts.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            {partialText && (
              <p className="text-slate-400 dark:text-slate-500 italic">{partialText}</p>
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}
      {status === "processing" && (
        <p className="text-slate-500 dark:text-slate-400 text-sm">대화 정리 중...</p>
      )}
      {status === "error" && (
        <div className="text-center space-y-2">
          <p className="text-red-600 dark:text-red-400 text-sm">{error ?? "오류가 발생했습니다."}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-500 dark:text-slate-400 underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
