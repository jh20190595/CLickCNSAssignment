"use client";

import { useEffect, useState } from "react";
import type { Patient, SessionMeta, Soap, VisitType } from "@/lib/types";
import { EMPTY_SOAP } from "@/lib/types";
import { classifySoap } from "@/lib/soapClient";
import { saveSession, updateSession } from "@/lib/sessionStore";
import { ExportMenu } from "@/components/ExportMenu";
import { SoapPanel } from "@/components/SoapPanel";

interface SoapEditorProps {
  patient: Patient;
  meta: SessionMeta;
  onMetaChange: (m: SessionMeta) => void;
  rawTranscript: string;
  soap: Soap;
  onSoapChange: (s: Soap) => void;
  sessionId: string | null;
  onSessionSaved: (id: string) => void;
  onDone: () => void;
}

export function SoapEditor({
  patient,
  meta,
  onMetaChange,
  rawTranscript,
  soap,
  onSoapChange,
  sessionId,
  onSessionSaved,
  onDone,
}: SoapEditorProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const hasContent =
      soap.subjective || soap.objective || soap.assessment || soap.plan;
    if (hasContent || !rawTranscript) return;
    runClassify(rawTranscript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTranscript]);

  async function runClassify(text: string) {
    setIsClassifying(true);
    setClassifyError(null);
    try {
      const result = await classifySoap(text, patient, meta);
      onSoapChange(result);
    } catch (e) {
      setClassifyError(e instanceof Error ? e.message : "SOAP 분류 실패");
      onSoapChange(EMPTY_SOAP);
    } finally {
      setIsClassifying(false);
    }
  }

  function updateField(field: keyof Soap, value: string) {
    onSoapChange({ ...soap, [field]: value });
    setSaveState("idle");
  }

  function handleSave() {
    setSaveState("saving");
    if (sessionId) {
      updateSession(sessionId, { rawTranscript, soap, meta });
    } else {
      const id = saveSession({
        patientId: patient.id,
        meta,
        rawTranscript,
        soap,
      });
      onSessionSaved(id);
    }
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3 text-slate-700">
          <span className="font-medium">
            {patient.name}{" "}
            <span className="text-slate-400 font-normal">· {patient.patientCode}</span>
          </span>
          <VisitTypeToggle
            value={meta.visitType}
            onChange={(v) => onMetaChange({ ...meta, visitType: v })}
          />
          <input
            type="text"
            value={meta.chiefComplaint}
            onChange={(e) =>
              onMetaChange({ ...meta, chiefComplaint: e.target.value })
            }
            placeholder="주증상"
            className="px-2 py-0.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          {isClassifying && (
            <span className="text-slate-500 text-xs">SOAP 자동 분류 중...</span>
          )}
          {classifyError && (
            <button
              onClick={() => runClassify(rawTranscript)}
              className="text-xs text-red-600 underline"
            >
              재시도
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
          <SoapPanel
            label="S — Subjective"
            hint="주관적 정보 (환자 호소, 병력)"
            value={soap.subjective}
            onChange={(v) => updateField("subjective", v)}
            onRegenerate={
              isClassifying ? undefined : () => runClassify(rawTranscript)
            }
          />
          <SoapPanel
            label="O — Objective"
            hint="객관적 정보 (활력징후, 검사 소견)"
            value={soap.objective}
            onChange={(v) => updateField("objective", v)}
          />
          <SoapPanel
            label="A — Assessment"
            hint="평가 (진단, 감별진단)"
            value={soap.assessment}
            onChange={(v) => updateField("assessment", v)}
          />
          <SoapPanel
            label="P — Plan"
            hint="계획 (처방, 추적, 교육)"
            value={soap.plan}
            onChange={(v) => updateField("plan", v)}
          />
        </div>

        {showRaw && (
          <div className="max-w-6xl mx-auto mt-4 p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">원본 전사</span>
              <button
                onClick={() => setShowRaw(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {rawTranscript || "(전사 결과 없음)"}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          {showRaw ? "원본 전사 숨기기" : "원본 전사 보기"}
        </button>
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
            className="px-4 py-1.5 text-sm bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-md transition-colors"
          >
            {saveState === "saved" ? "저장됨" : "저장"}
          </button>
          <button
            onClick={onDone}
            className="px-4 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitTypeToggle({
  value,
  onChange,
}: {
  value: VisitType;
  onChange: (v: VisitType) => void;
}) {
  return (
    <div className="flex border border-slate-200 rounded-md overflow-hidden">
      {(["초진", "재진"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2 py-0.5 text-xs ${
            value === v
              ? "bg-sky-50 text-sky-700 font-medium"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
