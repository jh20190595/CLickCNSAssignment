"use client";

import { useEffect, useState } from "react";
import type {
  Patient,
  PlanSections,
  SessionMeta,
  Soap,
  Utterance,
  VisitType,
} from "@/lib/types";
import {
  EMPTY_PLAN,
  EMPTY_SOAP,
  SPEAKER_KOREAN,
  isSoapEmpty,
} from "@/lib/types";
import { classifySoap } from "@/lib/soapClient";
import { saveSession, updateSession } from "@/lib/sessionStore";
import { ExportMenu } from "@/components/ExportMenu";
import { SoapPanel } from "@/components/SoapPanel";
import { PlanPanel } from "@/components/PlanPanel";
import { CcCard } from "@/components/CcCard";

type ViewMode = "soap-only" | "split";

interface SoapEditorProps {
  /** 현재 세션의 환자. 헤더 라벨 + 저장 시 patientId로 사용 */
  patient: Patient;
  /** 초진/재진 메타. 상위 state 그대로 controlled */
  meta: SessionMeta;
  /** meta 필드 편집 콜백 (초진/재진 토글) */
  onMetaChange: (m: SessionMeta) => void;
  /** 정규화된 원본 전사. 마운트 시 LLM 자동 분류 입력 + "원본 전사 보기"로 노출 */
  rawTranscript: string;
  /** CC + S/O/A/P 섹션 값. 비어있고 rawTranscript가 있으면 자동 분류 1회 실행 */
  soap: Soap;
  /** 섹션 편집 · 재생성 · 자동 분류 결과를 올려주는 controlled 콜백 */
  onSoapChange: (s: Soap) => void;
  /** 화자 라벨된 세그먼트 (옵션). 있으면 원문 보기가 의사/환자 라벨로 렌더 */
  segments?: Utterance[];
  /** 기존 세션 열람 시 그 id, 새 세션이면 null. 저장 경로 분기(save vs update) */
  sessionId: string | null;
  /** 신규 저장 후 발급된 id 전달 — 이후 수정은 update로 전환 */
  onSessionSaved: (id: string) => void;
  /** "완료" 버튼 클릭 — 상위에서 mode를 idle로 되돌리고 state 초기화 */
  onDone: () => void;
}

export function SoapEditor({
  patient,
  meta,
  onMetaChange,
  rawTranscript,
  soap,
  onSoapChange,
  segments,
  sessionId,
  onSessionSaved,
  onDone,
}: SoapEditorProps) {
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("soap-only");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!isSoapEmpty(soap) || !rawTranscript) return;
    runClassify(rawTranscript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTranscript]);

  async function runClassify(text: string) {
    setIsClassifying(true);
    setClassifyError(null);
    try {
      const result = await classifySoap(
        text,
        patient,
        meta,
        soap.chiefComplaint,
        hasSegments ? segments : undefined,
      );
      onSoapChange(result);
    } catch (e) {
      setClassifyError(e instanceof Error ? e.message : "SOAP 분류 실패");
      onSoapChange({ ...EMPTY_SOAP, plan: { ...EMPTY_PLAN } });
    } finally {
      setIsClassifying(false);
    }
  }

  function updateField(
    field: "chiefComplaint" | "subjective" | "objective" | "assessment",
    value: string,
  ) {
    onSoapChange({ ...soap, [field]: value });
    setSaveState("idle");
  }

  function updatePlanField(field: keyof PlanSections, value: string) {
    onSoapChange({ ...soap, plan: { ...soap.plan, [field]: value } });
    setSaveState("idle");
  }

  function handleSave() {
    setSaveState("saving");
    if (sessionId) {
      updateSession(sessionId, {
        rawTranscript,
        soap,
        meta,
        segments: hasSegments ? segments : undefined,
      });
    } else {
      const id = saveSession({
        patientId: patient.id,
        meta,
        rawTranscript,
        soap,
        segments: hasSegments ? segments : undefined,
      });
      onSessionSaved(id);
    }
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
  }

  const soapBody = (
    <div className="max-w-6xl mx-auto space-y-4">
      <CcCard
        value={soap.chiefComplaint}
        onChange={(v) => updateField("chiefComplaint", v)}
        onRegenerate={
          isClassifying ? undefined : () => runClassify(rawTranscript)
        }
        regenerateDisabled={isClassifying}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SoapPanel
          label="S — Subjective"
          hint="주관적 정보 (환자 호소, 병력)"
          accent="s"
          value={soap.subjective}
          onChange={(v) => updateField("subjective", v)}
          onRegenerate={
            isClassifying ? undefined : () => runClassify(rawTranscript)
          }
        />
        <SoapPanel
          label="O — Objective"
          hint="객관적 정보 (활력징후, 검사 소견)"
          accent="o"
          value={soap.objective}
          onChange={(v) => updateField("objective", v)}
        />
      </div>

      <SoapPanel
        label="A — Assessment"
        hint="평가 (진단, 감별진단)"
        accent="a"
        value={soap.assessment}
        onChange={(v) => updateField("assessment", v)}
      />

      <PlanPanel
        value={soap.plan}
        onChange={updatePlanField}
        onRegenerate={
          isClassifying ? undefined : () => runClassify(rawTranscript)
        }
        regenerateDisabled={isClassifying}
      />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-slate-200 bg-white px-6 py-2 flex items-center justify-between text-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
          <span className="font-medium">
            {patient.name}{" "}
            <span className="text-slate-400 font-normal dark:text-slate-500">· {patient.patientCode}</span>
          </span>
          <VisitTypeToggle
            value={meta.visitType}
            onChange={(v) => onMetaChange({ ...meta, visitType: v })}
          />
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          {isClassifying && (
            <span className="text-slate-500 text-xs dark:text-slate-400">SOAP 자동 분류 중...</span>
          )}
          {classifyError && (
            <button
              onClick={() => runClassify(rawTranscript)}
              className="text-xs text-red-600 underline dark:text-red-400"
            >
              재시도
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "split" ? (
          <div className="h-full grid grid-cols-[minmax(280px,1fr)_2fr]">
            <TranscriptPanel
              segments={segments}
              rawTranscript={rawTranscript}
            />
            <div className="overflow-auto px-6 py-4 border-l border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/40">
              {soapBody}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto px-6 py-4">{soapBody}</div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-end dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ExportMenu
            patient={patient}
            meta={meta}
            soap={soap}
            rawTranscript={rawTranscript}
          />
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="px-4 py-1.5 text-sm bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-md transition-colors dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
          >
            {saveState === "saved" ? "저장됨" : "저장"}
          </button>
          <button
            onClick={onDone}
            className="px-4 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options: { v: ViewMode; label: string }[] = [
    { v: "soap-only", label: "SOAP" },
    { v: "split", label: "원문 + SOAP" },
  ];
  return (
    <div className="flex border border-slate-200 rounded-md overflow-hidden dark:border-slate-700">
      {options.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 text-xs ${
            value === v
              ? "bg-sky-50 text-sky-700 font-medium dark:bg-sky-950/40 dark:text-sky-300"
              : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TranscriptPanel({
  segments,
  rawTranscript,
}: {
  segments?: Utterance[];
  rawTranscript: string;
}) {
  const hasSegments = Array.isArray(segments) && segments.length > 0;

  const plainChunks = hasSegments
    ? []
    : rawTranscript
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

  return (
    <aside className="flex flex-col min-h-0 bg-white dark:bg-slate-900">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          원문 전사{hasSegments ? " · 화자 라벨" : ""}
        </span>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3">
        {hasSegments ? (
          <ul className="space-y-1.5 text-sm leading-relaxed">
            {segments!.map((seg, i) => (
              <li key={i} className="flex gap-2 rounded px-1.5 py-1">
                <span
                  className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                    seg.speaker === "doctor"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  {SPEAKER_KOREAN[seg.speaker]}
                </span>
                <span
                  className={
                    seg.speaker === "doctor"
                      ? "text-slate-800 dark:text-slate-200"
                      : "text-emerald-900 dark:text-emerald-200"
                  }
                >
                  {seg.text}
                </span>
              </li>
            ))}
          </ul>
        ) : plainChunks.length ? (
          <ul className="space-y-2 text-sm leading-relaxed">
            {plainChunks.map((chunk, i) => (
              <li key={i} className="rounded px-2 py-1.5 text-slate-800 dark:text-slate-200">
                {chunk}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">(대화 내용 없음)</p>
        )}
      </div>
    </aside>
  );
}

function VisitTypeToggle({
  value,
  onChange,
}: {
  /** 현재 선택값 ("초진" | "재진") */
  value: VisitType;
  /** 버튼 클릭 시 반대 값 전달 */
  onChange: (v: VisitType) => void;
}) {
  return (
    <div className="flex border border-slate-200 rounded-md overflow-hidden dark:border-slate-700">
      {(["초진", "재진"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 text-xs ${
            value === v
              ? "bg-sky-50 text-sky-700 font-medium dark:bg-sky-950/40 dark:text-sky-300"
              : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
