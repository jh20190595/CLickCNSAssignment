"use client";

import { useStt } from "@/hooks/useStt";
import { MicButton } from "@/components/MicButton";
import { TranscriptBox } from "@/components/TranscriptBox";

export default function Home() {
  const { status, partialText, finalTexts, error, startRecording, stopRecording, clearTexts } =
    useStt();

  const statusLabel: Record<typeof status, string> = {
    idle: "대기 중",
    connecting: "연결 중...",
    recording: "녹음 중",
    processing: "변환 중...",
    error: "오류",
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-10 px-6">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          음성 텍스트 변환
        </h1>
        <p className="text-gray-500 text-sm">한국어 실시간 음성 인식</p>
      </div>

      {/* 마이크 버튼 */}
      <div className="flex flex-col items-center gap-4">
        <MicButton
          status={status}
          onStart={startRecording}
          onStop={stopRecording}
        />
        <span
          className={`text-sm font-medium ${
            status === "recording"
              ? "text-red-400"
              : status === "error"
              ? "text-red-500"
              : "text-gray-500"
          }`}
        >
          {statusLabel[status]}
        </span>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-900 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* 변환 결과 박스 */}
      <TranscriptBox
        finalTexts={finalTexts}
        partialText={partialText}
        onClear={clearTexts}
      />

      {/* 하단 안내 */}
      <p className="text-gray-700 text-xs text-center">
        마이크 버튼을 누르고 말하면 텍스트로 변환됩니다
      </p>
    </main>
  );
}
