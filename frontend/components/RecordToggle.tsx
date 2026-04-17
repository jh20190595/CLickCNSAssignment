"use client";

import type { SttStatus } from "@/hooks/useStt";

interface RecordToggleProps {
  /** useStt가 노출하는 세션 상태. 라벨/아이콘/클릭 가능 여부 결정 */
  status: SttStatus;
  /** 녹음 시작 후 경과 초. "mm:ss · 정지" 포맷에 사용 */
  elapsed: number;
  /** 환자 미선택/리뷰 모드 등 클릭 금지 상태 */
  disabled?: boolean;
  /** disabled일 때 title 툴팁으로 노출 (예: "먼저 환자를 선택하세요") */
  disabledReason?: string;
  /** idle 상태에서 클릭 시 호출 — 녹음 시작 */
  onStart: () => void;
  /** recording 상태에서 클릭 시 호출 — 녹음 정지 */
  onStop: () => void;
}

export function RecordToggle({
  status,
  elapsed,
  disabled,
  disabledReason,
  onStart,
  onStop,
}: RecordToggleProps) {
  const isRecording = status === "recording";
  const isBusy = status === "connecting" || status === "processing";

  const label = isRecording
    ? `${formatTime(elapsed)} · 정지`
    : isBusy
      ? status === "connecting"
        ? "준비 중…"
        : "처리 중…"
      : "녹음";

  const handleClick = () => {
    if (disabled || isBusy) return;
    if (isRecording) onStop();
    else onStart();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isBusy}
      title={disabled ? disabledReason : undefined}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
        disabled || isBusy
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600"
          : isRecording
            ? "bg-red-600 hover:bg-red-700 border-red-600 text-white dark:bg-red-500 dark:hover:bg-red-600 dark:border-red-500"
            : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
      }`}
    >
      {isRecording ? <StopIcon /> : <MicIcon />}
      <span className="font-mono text-xs tabular-nums">{label}</span>
    </button>
  );
}

function formatTime(sec: number): string {
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
