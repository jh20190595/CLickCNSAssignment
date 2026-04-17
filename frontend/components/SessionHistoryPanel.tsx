"use client";

import { useEffect, useMemo, useState } from "react";
import type { Patient, Session } from "@/lib/types";
import { deleteSession, listSessions } from "@/lib/sessionStore";
import { getPatient, listPatients } from "@/lib/patientStore";

interface SessionHistoryPanelProps {
  /** 현재 선택된 환자. null이면 "이 환자만" 토글 숨김 */
  patient: Patient | null;
  /** 세션 아이템 클릭 시 호출 — 상위에서 review 모드로 전환 */
  onOpen: (session: Session) => void;
  /** 다른 환자의 세션 클릭 시 헤더 PatientSelector를 그 환자로 전환 */
  onPatientSelect: (patient: Patient | null) => void;
  /** 상위에서 저장/완료 후 증가 — 세션 리스트 강제 재조회 트리거 */
  refreshKey?: number;
  /** 현재 편집 중인 세션 id. 일치하는 아이템에 파란 바 + 배경 하이라이트 */
  activeSessionId?: string | null;
  /** true면 opacity-50 + pointer-events-none (녹음 중엔 열기/삭제 불가) */
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
      className={`border-l border-slate-200 bg-white flex flex-col min-h-0 dark:bg-slate-900 dark:border-slate-800 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">진료 기록</h2>
        {patient && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none dark:text-slate-400">
            <input
              type="checkbox"
              checked={onlyCurrent}
              onChange={(e) => setOnlyCurrent(e.target.checked)}
              className="accent-slate-700 dark:accent-slate-400"
            />
            이 환자만
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {onlyCurrent
              ? "이 환자의 진료 기록이 없습니다."
              : "아직 기록된 진료가 없습니다."}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {visible.map((s) => {
            const isActive = s.id === activeSessionId;
            const name = patientNameMap.get(s.patientId) ?? "알 수 없음";
            return (
              <li
                key={s.id}
                className={`group relative border-b border-slate-100 dark:border-slate-800 ${
                  isActive
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 dark:bg-blue-400" />
                )}
                <button
                  onClick={() => handleClick(s)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate dark:text-slate-100">
                      {name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 dark:text-slate-500">
                      {formatDate(s.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 truncate dark:text-slate-400">
                    {s.meta.visitType}
                    {s.soap.chiefComplaint && ` · ${s.soap.chiefComplaint}`}
                  </div>
                </button>
                <button
                  onClick={(e) => handleDelete(e, s.id)}
                  className="absolute top-2 right-2 text-[10px] text-slate-300 hover:text-red-600 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity dark:text-slate-600 dark:hover:text-red-400"
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
