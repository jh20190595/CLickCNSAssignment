"use client";

import { useEffect, useRef } from "react";

interface TranscriptBoxProps {
  finalTexts: string[];
  partialText: string;
  onClear: () => void;
}

export function TranscriptBox({ finalTexts, partialText, onClear }: TranscriptBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTexts, partialText]);

  const isEmpty = finalTexts.length === 0 && !partialText;

  return (
    <div className="relative w-full max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400 font-medium">변환 결과</span>
        {!isEmpty && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
          >
            지우기
          </button>
        )}
      </div>

      <div className="min-h-48 max-h-80 overflow-y-auto rounded-2xl bg-gray-900 border border-gray-800 p-5">
        {isEmpty ? (
          <p className="text-gray-600 text-center mt-12 text-sm select-none">
            마이크 버튼을 눌러 말씀하세요
          </p>
        ) : (
          <div className="space-y-2 text-lg leading-relaxed">
            {finalTexts.map((text, i) => (
              <p key={i} className="text-gray-100">
                {text}
              </p>
            ))}
            {partialText && (
              <p className="text-gray-400 italic">{partialText}...</p>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
