"use client";

interface RecordingIndicatorProps {
  isPaused: boolean;
  status: string;
  error: string | null;
}

export function RecordingIndicator({ isPaused, status, error }: RecordingIndicatorProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 select-none">
      {status === "connecting" && (
        <p className="text-slate-500 text-sm">마이크 준비 중...</p>
      )}
      {status === "recording" && (
        <>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-sm text-slate-700 font-medium">
              {isPaused ? "일시정지 (타이핑 감지)" : "녹음 중"}
            </span>
          </div>
          <p className="mt-10 text-xs text-slate-400">
            환자와의 대화에 집중하세요
          </p>
        </>
      )}
      {status === "processing" && (
        <p className="text-slate-500 text-sm">전사 마무리 중...</p>
      )}
      {status === "error" && (
        <div className="text-center space-y-2">
          <p className="text-red-600 text-sm">{error ?? "오류가 발생했습니다."}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-500 underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
