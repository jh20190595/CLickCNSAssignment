"use client";

import { useEffect, useRef } from "react";
import styles from "./RecordingIndicator.module.css";

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
    <div className={styles.container}>
      {status === "connecting" && (
        <p className={styles.connectingText}>마이크 준비 중...</p>
      )}
      {status === "recording" && (
        <>
          <div className={styles.dotWrapper}>
            <span
              className={isPaused ? styles.dotPaused : styles.dotRecording}
            />
            <span className={styles.statusLabel}>
              {isPaused ? "일시정지 (타이핑 감지)" : "녹음 중"}
            </span>
          </div>
          <div className={styles.transcriptArea}>
            {finalTexts.length === 0 && !partialText && (
              <p className={styles.emptyHint}>
                환자와의 대화에 집중하세요
              </p>
            )}
            {finalTexts.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            {partialText && (
              <p className={styles.partialText}>{partialText}</p>
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}
      {status === "processing" && (
        <p className={styles.processingText}>대화 정리 중...</p>
      )}
      {status === "error" && (
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error ?? "오류가 발생했습니다."}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles.retryLink}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
