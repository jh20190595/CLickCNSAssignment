"use client";

import { useEffect, useRef } from "react";

interface ConversationPanelProps {
  finalTexts: string[];
  partialText: string;
  reviewTranscript?: string;
  mode: "idle" | "recording" | "review";
  isPaused: boolean;
}

export function ConversationPanel({
  finalTexts,
  partialText,
  reviewTranscript,
  mode,
  isPaused,
}: ConversationPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTexts, partialText, reviewTranscript]);

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col">
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">대화 내용</span>
          {mode === "recording" && (
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                isPaused ? "text-amber-600" : "text-red-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"
                }`}
              />
              {isPaused ? "일시정지" : "녹음 중"}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 text-sm leading-relaxed">
        <ConversationBody
          finalTexts={finalTexts}
          partialText={partialText}
          reviewTranscript={reviewTranscript}
          mode={mode}
        />
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}

function ConversationBody({
  finalTexts,
  partialText,
  reviewTranscript,
  mode,
}: {
  finalTexts: string[];
  partialText: string;
  reviewTranscript?: string;
  mode: "idle" | "recording" | "review";
}) {
  if (mode === "review") {
    if (!reviewTranscript?.trim()) {
      return <Placeholder text="전사 결과가 없습니다" />;
    }
    return (
      <p className="text-slate-700 whitespace-pre-wrap">{reviewTranscript}</p>
    );
  }

  if (mode === "recording") {
    const hasContent = finalTexts.length > 0 || partialText;
    if (!hasContent) {
      return <Placeholder text="말씀을 시작하면 이곳에 대화가 기록됩니다" />;
    }
    return (
      <div className="space-y-2">
        {finalTexts.map((t, i) => (
          <p key={i} className="text-slate-800">
            {t}
          </p>
        ))}
        {partialText && (
          <p className="text-slate-400 italic">{partialText}…</p>
        )}
      </div>
    );
  }

  return (
    <Placeholder text="녹음을 시작하면 이곳에 실시간 대화 내용이 표시됩니다" />
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4 min-h-32">
      {text}
    </div>
  );
}
