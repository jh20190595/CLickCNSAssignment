"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/types";
import { createPatient, deletePatient, searchPatients } from "@/lib/patientStore";
import { deleteSessionsByPatient } from "@/lib/sessionStore";

interface PatientSelectorProps {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient | null) => void;
  disabled?: boolean;
}

export function PatientSelector({
  selectedPatient,
  onSelect,
  disabled,
}: PatientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setResults(searchPatients(query));
  }, [open, query]);

  useEffect(() => {
    if (!open || showAddModal) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, showAddModal]);

  function handleSelect(p: Patient) {
    onSelect(p);
    setOpen(false);
    setQuery("");
  }

  function handleCreate(name: string, patientCode: string) {
    const p = createPatient({ name, patientCode });
    setShowAddModal(false);
    handleSelect(p);
  }

  function handleDelete(e: React.MouseEvent, p: Patient) {
    e.stopPropagation();
    const ok = confirm(
      `"${p.name} (${p.patientCode})" 환자를 삭제합니다.\n이 환자의 모든 진료 기록도 함께 삭제됩니다. 계속할까요?`,
    );
    if (!ok) return;
    deletePatient(p.id);
    deleteSessionsByPatient(p.id);
    setResults(searchPatients(query));
    if (selectedPatient?.id === p.id) onSelect(null);
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
            disabled
              ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
              : selectedPatient
                ? "bg-white border-slate-300 text-slate-800 hover:border-slate-400"
                : "bg-white border-slate-300 text-slate-500 hover:border-slate-400"
          }`}
        >
          <SearchIcon />
          {selectedPatient ? (
            <span className="flex items-center gap-1">
              <span className="font-medium">{selectedPatient.name}</span>
              <span className="text-slate-400">· {selectedPatient.patientCode}</span>
            </span>
          ) : (
            <span>환자 검색</span>
          )}
          <span className="text-slate-400">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 환자코드 검색"
                autoFocus
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            <ul className="max-h-64 overflow-auto">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-slate-400">
                  {query ? "검색 결과 없음" : "등록된 환자가 없습니다"}
                </li>
              ) : (
                results.map((p) => (
                  <li
                    key={p.id}
                    className={`group flex items-center hover:bg-slate-50 ${
                      selectedPatient?.id === p.id ? "bg-sky-50" : ""
                    }`}
                  >
                    <button
                      onClick={() => handleSelect(p)}
                      className="flex-1 text-left px-3 py-2"
                    >
                      <div className="text-sm font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.patientCode}</div>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, p)}
                      aria-label="환자 삭제"
                      className="p-2 mr-1 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-slate-100 p-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full text-sm text-sky-700 hover:bg-sky-50 py-1.5 rounded-md"
              >
                + 새 환자 추가
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <NewPatientModal
          initialName={query}
          onCancel={() => setShowAddModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
}

function NewPatientModal({
  initialName,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  onSubmit: (name: string, patientCode: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canSubmit = name.trim().length > 0 && code.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit(name.trim(), code.trim());
        }}
        className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">새 환자 추가</h2>
          <p className="text-xs text-slate-500 mt-1">
            이름과 환자코드를 입력해주세요.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">환자코드</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: P00123"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm py-2 rounded-md transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-sm py-2 rounded-md transition-colors"
          >
            추가
          </button>
        </div>
      </form>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
