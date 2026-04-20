'use client';

import { useEffect, useState } from 'react';
import type {
  Patient,
  PlanSections,
  SessionMeta,
  Soap,
  Utterance,
  VisitType,
} from '@/lib/types';
import {
  EMPTY_PLAN,
  EMPTY_SOAP,
  SPEAKER_KOREAN,
  isSoapEmpty,
} from '@/lib/types';
import { classifySoap } from '@/lib/soapClient';
import { saveSession, updateSession } from '@/lib/sessionStore';
import styles from './SoapEditor.module.css';
import ExportMenu from '@/components/ExportMenu';
import SoapPanel from '@/components/SoapPanel';
import PlanPanel from '@/components/PlanPanel';
import CcCard from '@/components/CcCard';

type ViewMode = 'soap-only' | 'split';

interface Props {
  patient: Patient;
  meta: SessionMeta;
  onMetaChange: (m: SessionMeta) => void;
  rawTranscript: string;
  soap: Soap;
  onSoapChange: (s: Soap) => void;
  segments?: Utterance[];
  sessionId: string | null;
  onSessionSaved: (id: string) => void;
  onDone: () => void;
}

export default function SoapEditor({
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
}: Props) {
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('soap-only');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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
      setClassifyError(e instanceof Error ? e.message : 'SOAP 분류 실패');
      onSoapChange({ ...EMPTY_SOAP, plan: { ...EMPTY_PLAN } });
    } finally {
      setIsClassifying(false);
    }
  }

  function updateField(
    field: 'chiefComplaint' | 'subjective' | 'objective' | 'assessment',
    value: string,
  ) {
    onSoapChange({ ...soap, [field]: value });
    setSaveState('idle');
  }

  function updatePlanField(field: keyof PlanSections, value: string) {
    onSoapChange({ ...soap, plan: { ...soap.plan, [field]: value } });
    setSaveState('idle');
  }

  function handleSave() {
    setSaveState('saving');
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
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1500);
  }

  const soapBody = (
    <div className={styles.soapBody}>
      <CcCard
        value={soap.chiefComplaint}
        onChange={(v) => updateField('chiefComplaint', v)}
      />

      <div className={styles.soapQuadrant}>
        <SoapPanel
          label="S — Subjective"
          hint="주관적 정보 (환자 호소, 병력)"
          accent="s"
          value={soap.subjective}
          onChange={(v) => updateField('subjective', v)}
        />
        <SoapPanel
          label="O — Objective"
          hint="객관적 정보 (활력징후, 검사 소견)"
          accent="o"
          value={soap.objective}
          onChange={(v) => updateField('objective', v)}
        />
        <SoapPanel
          label="A — Assessment"
          hint="평가 (진단, 감별진단)"
          accent="a"
          value={soap.assessment}
          onChange={(v) => updateField('assessment', v)}
        />
        <PlanPanel
          value={soap.plan}
          onChange={updatePlanField}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.patientInfo}>
          <span className={styles.patientName}>
            {patient.name}{' '}
            <span className={styles.patientCodeSpan}>· {patient.patientCode}</span>
          </span>
          <VisitTypeToggle
            value={meta.visitType}
            onChange={(v) => onMetaChange({ ...meta, visitType: v })}
          />
        </div>
        <div className={styles.rightActions}>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          {isClassifying && (
            <span className={styles.classifyingText}>SOAP 자동 분류 중...</span>
          )}
          {classifyError && (
            <button
              onClick={() => runClassify(rawTranscript)}
              className={styles.retryLink}
            >
              재시도
            </button>
          )}
        </div>
      </div>

      <div className={styles.contentArea}>
        {viewMode === 'split' ? (
          <div className={styles.splitGrid}>
            <TranscriptPanel
              segments={segments}
              rawTranscript={rawTranscript}
            />
            <div className={styles.soapScrollRight}>
              {soapBody}
            </div>
          </div>
        ) : (
          <div className={styles.singleScroll}>{soapBody}</div>
        )}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.actions}>
          <ExportMenu
            patient={patient}
            meta={meta}
            soap={soap}
            rawTranscript={rawTranscript}
          />
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className={styles.saveButton}
          >
            {saveState === 'saved' ? '저장됨' : '저장'}
          </button>
          <button
            onClick={onDone}
            className={styles.doneButton}
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
    { v: 'soap-only', label: 'SOAP' },
    { v: 'split', label: '원문 + SOAP' },
  ];
  return (
    <div className={styles.toggleWrapper}>
      {options.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={value === v ? styles.toggleActive : styles.toggleInactive}
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
    <aside className={styles.transcriptAside}>
      <div className={styles.transcriptHeader}>
        <span className={styles.transcriptHeaderText}>
          원문 전사{hasSegments ? ' · 화자 라벨' : ''}
        </span>
      </div>
      <div className={styles.transcriptContent}>
        {hasSegments ? (
          <ul className={styles.segmentList}>
            {segments!.map((seg, i) => (
              <li key={i} className={styles.segmentItem}>
                <span
                  className={
                    seg.speaker === 'doctor'
                      ? styles.speakerDoctor
                      : styles.speakerPatient
                  }
                >
                  {SPEAKER_KOREAN[seg.speaker]}
                </span>
                <span
                  className={
                    seg.speaker === 'doctor'
                      ? styles.doctorText
                      : styles.patientText
                  }
                >
                  {seg.text}
                </span>
              </li>
            ))}
          </ul>
        ) : plainChunks.length ? (
          <ul className={styles.plainList}>
            {plainChunks.map((chunk, i) => (
              <li key={i} className={styles.plainItem}>
                {chunk}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyText}>(대화 내용 없음)</p>
        )}
      </div>
    </aside>
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
    <div className={styles.toggleWrapper}>
      {(['초진', '재진'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={value === v ? styles.toggleActive : styles.toggleInactive}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
