"use client";

import { SttStatus } from "@/hooks/useStt";

interface MicButtonProps {
  status: SttStatus;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ status, onStart, onStop }: MicButtonProps) {
  const isRecording = status === "recording";
  const isLoading = status === "connecting" || status === "processing";

  return (
    <button
      onClick={isRecording ? onStop : onStart}
      disabled={isLoading}
      aria-label={isRecording ? "녹음 중지" : "녹음 시작"}
      className={`
        relative flex items-center justify-center w-24 h-24 rounded-full
        transition-all duration-300 focus:outline-none focus-visible:ring-4
        focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
        ${isRecording
          ? "bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.5)]"
          : "bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
        }
      `}
    >
      {/* 녹음 중 파동 애니메이션 */}
      {isRecording && (
        <>
          <span className="absolute w-full h-full rounded-full bg-red-400 opacity-30 animate-ping" />
          <span className="absolute w-32 h-32 rounded-full border-2 border-red-400 opacity-20 animate-ping animation-delay-150" />
        </>
      )}

      {isLoading ? (
        <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : isRecording ? (
        // 정지 아이콘
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // 마이크 아이콘
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z" />
        </svg>
      )}
    </button>
  );
}
