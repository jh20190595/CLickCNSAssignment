"use client";

import { useEffect, useState } from "react";
import type { Patient, Session } from "@/lib/types";
import { deleteSession, listSessionsByPatient } from "@/lib/sessionStore";

interface PatientSessionsPanelProps {
  patient: Patient;
  onOpen: (session: Session) => void;
  refreshKey?: number;
}

export function PatientSessionsPanel({
  patient,
  onOpen,
  refreshKey,
}: PatientSessionsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    setSessions(listSessionsByPatient(patient.id));
  }, [patient.id, refreshKey]);

  function handleDelete(id: string) {
    if (!confirm("이 세션을 삭제할까요?")) return;
    deleteSession(id);
    setSessions(listSessionsByPatient(patient.id));
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{patient.name}</h2>
            <div className="text-xs text-slate-500 mt-0.5">{patient.patientCode}</div>
          </div>
          <div className="text-xs text-slate-400">
            {sessions.length}건의 진료 기록
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 text-sm text-slate-400">
            아직 기록된 진료가 없습니다.
            <div className="mt-1 text-xs text-slate-400">
              상단 중앙의 녹음 버튼을 눌러 새 진료를 시작하세요.
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-slate-300 transition-colors"
              >
                <button onClick={() => onOpen(s)} className="flex-1 text-left">
                  <div className="text-sm font-medium text-slate-900">
                    {s.meta.visitType}
                    {s.meta.chiefComplaint && (
                      <span className="text-slate-600 font-normal">
                        {" "}
                        · {s.meta.chiefComplaint}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatDate(s.createdAt)}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-slate-400 hover:text-red-600 px-2 py-1"
                  title="삭제"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
