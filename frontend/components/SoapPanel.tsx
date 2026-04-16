"use client";

interface SoapPanelProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onRegenerate?: () => void;
}

export function SoapPanel({ label, hint, value, onChange, onRegenerate }: SoapPanelProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-56">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
        <div>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className="ml-2 text-xs text-slate-500">{hint}</span>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            title="이 섹션 재생성"
            className="text-xs text-sky-600 hover:text-sky-800"
          >
            재생성
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="내용을 입력하거나 편집하세요"
        className="flex-1 w-full px-4 py-3 text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none"
      />
    </div>
  );
}
