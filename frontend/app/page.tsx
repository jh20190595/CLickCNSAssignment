"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Patient, Session, SessionMeta, Soap } from "@/lib/types";
import { DEFAULT_SESSION_META, EMPTY_SOAP } from "@/lib/types";
import { useStt } from "@/hooks/useStt";
import { useSettings } from "@/hooks/useSettings";
import { useHotkeys } from "@/hooks/useHotkeys";
import { PatientSelector } from "@/components/PatientSelector";
import { RecordToggle } from "@/components/RecordToggle";
import { PatientSessionsPanel } from "@/components/PatientSessionsPanel";
import { RecordingIndicator } from "@/components/RecordingIndicator";
import { SoapEditor } from "@/components/SoapEditor";
import { ConversationPanel } from "@/components/ConversationPanel";
import { SettingsButton } from "@/components/SettingsButton";
import { SettingsModal } from "@/components/SettingsModal";

type Mode = "idle" | "recording" | "review";

export default function Home() {
  const [settings, setSettings] = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    status,
    error,
    fullTranscript,
    finalTexts,
    partialText,
    isPaused,
    startRecording,
    stopRecording,
    insertNewline,
  } = useStt({ settings });

  const [patient, setPatient] = useState<Patient | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [meta, setMeta] = useState<SessionMeta>(DEFAULT_SESSION_META);
  const [rawTranscript, setRawTranscript] = useState("");
  const [soap, setSoap] = useState<Soap>(EMPTY_SOAP);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (status !== "recording") return;
    const startedAt = Date.now();
    setElapsed(0);
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      500,
    );
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (finishedRef.current) return;
    if (mode === "recording" && status === "idle" && fullTranscript) {
      finishedRef.current = true;
      setRawTranscript(fullTranscript);
      setMode("review");
    }
  }, [mode, status, fullTranscript]);

  const handleStart = useCallback(() => {
    if (!patient) return;
    finishedRef.current = false;
    setMeta(DEFAULT_SESSION_META);
    setRawTranscript("");
    setSoap(EMPTY_SOAP);
    setSessionId(null);
    setMode("recording");
    void startRecording();
  }, [patient, startRecording]);

  const handleStop = useCallback(() => {
    if (status === "recording") stopRecording();
  }, [status, stopRecording]);

  const openSession = useCallback((session: Session) => {
    setMeta(session.meta);
    setRawTranscript(session.rawTranscript);
    setSoap(session.soap);
    setSessionId(session.id);
    setMode("review");
  }, []);

  const exitReview = useCallback(() => {
    setMode("idle");
    setMeta(DEFAULT_SESSION_META);
    setRawTranscript("");
    setSoap(EMPTY_SOAP);
    setSessionId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handlePatientChange = useCallback((p: Patient | null) => {
    if (mode !== "idle") return;
    setPatient(p);
  }, [mode]);

  const toggleRecording = useCallback(() => {
    if (!patient) return;
    if (status === "recording") stopRecording();
    else if (mode !== "review" && status === "idle") handleStart();
  }, [patient, status, mode, stopRecording, handleStart]);

  useHotkeys(
    {
      [settings.shortcuts.toggleRecord]: toggleRecording,
      [settings.shortcuts.newline]:
        status === "recording" ? insertNewline : undefined,
    },
    { allowInEditable: [settings.shortcuts.toggleRecord] },
  );

  const recordDisabled = !patient || mode === "review";
  const recordDisabledReason = !patient
    ? "먼저 환자를 선택하세요"
    : mode === "review"
      ? "편집 중에는 녹음할 수 없습니다"
      : undefined;

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-2.5 grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-800">
            SOAP 진료 기록
          </span>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
        <div className="flex justify-center">
          <RecordToggle
            status={status}
            elapsed={elapsed}
            disabled={recordDisabled}
            disabledReason={recordDisabledReason}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>
        <div className="flex justify-end">
          <PatientSelector
            selectedPatient={patient}
            onSelect={handlePatientChange}
            disabled={mode !== "idle"}
          />
        </div>
      </header>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {mode === "idle" && !patient && <EmptyState />}
          {mode === "idle" && patient && (
            <PatientSessionsPanel
              patient={patient}
              onOpen={openSession}
              refreshKey={refreshKey}
            />
          )}
          {mode === "recording" && (
            <RecordingIndicator isPaused={isPaused} status={status} error={error} />
          )}
          {mode === "review" && patient && (
            <SoapEditor
              patient={patient}
              meta={meta}
              onMetaChange={setMeta}
              rawTranscript={rawTranscript}
              soap={soap}
              onSoapChange={setSoap}
              sessionId={sessionId}
              onSessionSaved={setSessionId}
              onDone={exitReview}
            />
          )}
        </div>
        <ConversationPanel
          mode={mode}
          finalTexts={finalTexts}
          partialText={partialText}
          reviewTranscript={mode === "review" ? rawTranscript : undefined}
          isPaused={isPaused}
        />
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center text-slate-500">
        <p className="text-sm">우측 상단에서 환자를 선택하거나 추가하세요.</p>
        <p className="text-xs text-slate-400 mt-1">
          환자를 선택하면 이전 진료 기록이 표시되고, 상단 녹음 버튼으로 새 진료를 시작할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
