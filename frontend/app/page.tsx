"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Patient, Session, SessionMeta, Soap, Utterance } from "@/lib/types";
import { DEFAULT_SESSION_META, EMPTY_SOAP, PLAN_LABELS } from "@/lib/types";
import { useStt } from "@/hooks/useStt";
import { useSettings } from "@/hooks/useSettings";
import { useHotkeys } from "@/hooks/useHotkeys";
import { PatientSelector } from "@/components/PatientSelector";
import { RecordToggle } from "@/components/RecordToggle";
import { RecordingIndicator } from "@/components/RecordingIndicator";
import { SoapEditor } from "@/components/SoapEditor";
import { SessionHistoryPanel } from "@/components/SessionHistoryPanel";
import { SettingsButton } from "@/components/SettingsButton";
import { SettingsModal } from "@/components/SettingsModal";
import styles from "./page.module.css";

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
    segments: sttSegments,
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
  const [sessionSegments, setSessionSegments] = useState<Utterance[]>([]);
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
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  useEffect(() => {
    if (finishedRef.current) return;
    if (mode === "recording" && status === "idle") {
      finishedRef.current = true;
      if (!fullTranscript) {
        alert(
          "녹음된 대화가 없습니다. 마이크 상태와 볼륨을 확인하고 다시 시도해주세요.",
        );
        setMode("idle");
        return;
      }
      setRawTranscript(fullTranscript);
      setSessionSegments(sttSegments);
      setMode("review");
    }
  }, [mode, status, fullTranscript, sttSegments]);

  const handleStart = useCallback(() => {
    if (!patient) return;
    finishedRef.current = false;
    setMeta(DEFAULT_SESSION_META);
    setRawTranscript("");
    setSoap(EMPTY_SOAP);
    setSessionSegments([]);
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
    setSessionSegments(session.segments ?? []);
    setSessionId(session.id);
    setMode("review");
  }, []);

  const exitReview = useCallback(() => {
    setMode("idle");
    setMeta(DEFAULT_SESSION_META);
    setRawTranscript("");
    setSoap(EMPTY_SOAP);
    setSessionSegments([]);
    setSessionId(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handlePatientChange = useCallback((p: Patient | null) => {
    if (mode === "recording") return;
    if (mode === "review" && p?.id !== patient?.id) {
      const ok = confirm(
        "편집 중인 SOAP이 저장되지 않을 수 있습니다. 환자를 전환할까요?",
      );
      if (!ok) return;
      exitReview();
    }
    setPatient(p);
  }, [mode, patient, exitReview]);

  const toggleRecording = useCallback(() => {
    if (!patient) return;
    if (status === "recording") stopRecording();
    else if (mode !== "review" && status === "idle") handleStart();
  }, [patient, status, mode, stopRecording, handleStart]);

  const copySectionText = useCallback((text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const copyPlan = useCallback(() => {
    const parts = (Object.keys(PLAN_LABELS) as Array<keyof typeof PLAN_LABELS>)
      .map((k) =>
        soap.plan[k]?.trim()
          ? `[${PLAN_LABELS[k]}]\n${soap.plan[k].trim()}`
          : "",
      )
      .filter(Boolean);
    if (!parts.length) return;
    void navigator.clipboard.writeText(parts.join("\n\n")).catch(() => {});
  }, [soap.plan]);

  const sc = settings.shortcuts;
  const copyEnabled = mode === "review";
  useHotkeys(
    {
      [sc.toggleRecord]: toggleRecording,
      [sc.newline]: status === "recording" ? insertNewline : undefined,
      [sc.copyCC]: copyEnabled ? () => copySectionText(soap.chiefComplaint) : undefined,
      [sc.copyS]: copyEnabled ? () => copySectionText(soap.subjective) : undefined,
      [sc.copyO]: copyEnabled ? () => copySectionText(soap.objective) : undefined,
      [sc.copyA]: copyEnabled ? () => copySectionText(soap.assessment) : undefined,
      [sc.copyP]: copyEnabled ? copyPlan : undefined,
    },
    {
      allowInEditable: [
        sc.toggleRecord,
        sc.copyCC,
        sc.copyS,
        sc.copyO,
        sc.copyA,
        sc.copyP,
      ],
    },
  );

  const recordDisabled = !patient || mode === "review";
  const recordDisabledReason = !patient
    ? "먼저 환자를 선택하세요"
    : mode === "review"
      ? "편집 중에는 녹음할 수 없습니다"
      : undefined;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>
            진료 내용
          </span>
        </div>
        <div className={styles.headerCenter}>
          <RecordToggle
            status={status}
            elapsed={elapsed}
            disabled={recordDisabled}
            disabledReason={recordDisabledReason}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>
        <div className={styles.headerRight}>
          <PatientSelector
            selectedPatient={patient}
            onSelect={handlePatientChange}
            disabled={mode === "recording"}
          />
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <div className={styles.contentGrid}>
        <div className={styles.mainArea}>
          {mode === "idle" && <EmptyState />}
          {mode === "recording" && (
            <RecordingIndicator
              isPaused={isPaused}
              status={status}
              error={error}
              finalTexts={finalTexts}
              partialText={partialText}
            />
          )}
          {mode === "review" && patient && (
            <SoapEditor
              patient={patient}
              meta={meta}
              onMetaChange={setMeta}
              rawTranscript={rawTranscript}
              soap={soap}
              onSoapChange={setSoap}
              segments={sessionSegments}
              sessionId={sessionId}
              onSessionSaved={setSessionId}
              onDone={exitReview}
            />
          )}
        </div>
        <SessionHistoryPanel
          patient={patient}
          onOpen={openSession}
          onPatientSelect={setPatient}
          refreshKey={refreshKey}
          activeSessionId={sessionId}
          disabled={mode === "recording"}
        />
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.emptyText}>
        <p className={styles.emptyMessage}>우측 상단에서 환자를 선택하고 녹음을 시작하세요.</p>
        <p className={styles.emptyHint}>
          과거 진료 기록은 우측 사이드바에서 열람할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
