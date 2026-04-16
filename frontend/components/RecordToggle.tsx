"use client";

import type { SttStatus } from "@/hooks/useStt";

interface RecordToggleProps {
  status: SttStatus;
  elapsed: number;
  disabled?: boolean;
  disabledReason?: string;
  onStart: () => void;
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
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : isRecording
            ? "bg-red-600 hover:bg-red-700 border-red-600 text-white"
            : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
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
