"use client";

import { useEffect, useMemo, useState } from "react";
import type { Patient, Session } from "@/lib/types";
import { deleteSession, listSessions } from "@/lib/sessionStore";
import { getPatient, listPatients } from "@/lib/patientStore";
import styles from "./SessionHistoryPanel.module.css";

interface SessionHistoryPanelProps {
  patient: Patient | null;
  onOpen: (session: Session) => void;
  onPatientSelect: (patient: Patient | null) => void;
  refreshKey?: number;
  activeSessionId?: string | null;
  disabled?: boolean;
}

export function SessionHistoryPanel({
  patient,
  onOpen,
  onPatientSelect,
  refreshKey,
  activeSessionId,
  disabled,
}: SessionHistoryPanelProps) {
  const [localRefresh, setLocalRefresh] = useState(0);
  const [onlyCurrent, setOnlyCurrent] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    setSessions(listSessions());
    setPatients(listPatients());
  }, [refreshKey, localRefresh]);

  const patientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) map.set(p.id, p.name);
    return map;
  }, [patients]);

  const visible = useMemo(() => {
    if (onlyCurrent && patient) {
      return sessions.filter((s) => s.patientId === patient.id);
    }
    return sessions;
  }, [sessions, onlyCurrent, patient]);

  function handleClick(session: Session) {
    if (disabled) return;
    if (!patient || patient.id !== session.patientId) {
      const next = getPatient(session.patientId);
      if (next) onPatientSelect(next);
    }
    onOpen(session);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (disabled) return;
    if (!confirm("이 세션을 삭제할까요?")) return;
    deleteSession(id);
    setLocalRefresh((n) => n + 1);
  }

  return (
    <aside
      className={`${styles.aside} ${disabled ? styles.disabled : ""}`}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>진료 기록</h2>
        {patient && (
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={onlyCurrent}
              onChange={(e) => setOnlyCurrent(e.target.checked)}
              className={styles.checkbox}
            />
            이 환자만
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            {onlyCurrent
              ? "이 환자의 진료 기록이 없습니다."
              : "아직 기록된 진료가 없습니다."}
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {visible.map((s) => {
            const isActive = s.id === activeSessionId;
            const name = patientNameMap.get(s.patientId) ?? "알 수 없음";
            return (
              <li
                key={s.id}
                className={`${styles.item} ${isActive ? styles.itemActive : styles.itemDefault}`}
              >
                {isActive && (
                  <span className={styles.activeBar} />
                )}
                <button
                  onClick={() => handleClick(s)}
                  className={styles.itemButton}
                >
                  <div className={styles.nameRow}>
                    <span className={styles.name}>
                      {name}
                    </span>
                    <span className={styles.date}>
                      {formatDate(s.createdAt)}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    {s.meta.visitType}
                    {s.soap.chiefComplaint && ` · ${s.soap.chiefComplaint}`}
                  </div>
                </button>
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className={styles.deleteBtn}
                  title="삭제"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
