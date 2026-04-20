"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/types";
import { createPatient, deletePatient, searchPatients } from "@/lib/patientStore";
import { deleteSessionsByPatient } from "@/lib/sessionStore";
import styles from "./PatientSelector.module.css";

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
      <div className={styles.wrapper} ref={ref}>
        <button
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className={
            disabled
              ? styles.mainButtonDisabled
              : selectedPatient
                ? styles.mainButtonSelected
                : styles.mainButtonEmpty
          }
        >
          <SearchIcon />
          {selectedPatient ? (
            <span className={styles.selectedInfo}>
              <span className={styles.selectedName}>{selectedPatient.name}</span>
              <span className={styles.patientCode}>· {selectedPatient.patientCode}</span>
            </span>
          ) : (
            <span>환자 검색</span>
          )}
          <span className={styles.dropdownArrow}>▾</span>
        </button>

        {open && (
          <div className={styles.dropdown}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 환자코드 검색"
                autoFocus
                className={styles.searchInput}
              />
            </div>

            <ul className={styles.list}>
              {results.length === 0 ? (
                <li className={styles.emptyResult}>
                  {query ? "검색 결과 없음" : "등록된 환자가 없습니다"}
                </li>
              ) : (
                results.map((p) => (
                  <li
                    key={p.id}
                    className={
                      selectedPatient?.id === p.id
                        ? styles.listItemSelected
                        : styles.listItem
                    }
                  >
                    <button
                      onClick={() => handleSelect(p)}
                      className={styles.itemButton}
                    >
                      <div className={styles.itemName}>{p.name}</div>
                      <div className={styles.itemCode}>{p.patientCode}</div>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, p)}
                      aria-label="환자 삭제"
                      className={styles.deleteButton}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className={styles.footer}>
              <button
                onClick={() => setShowAddModal(true)}
                className={styles.addButton}
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
      className={styles.overlay}
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
        className={styles.form}
      >
        <div>
          <h2 className={styles.modalTitle}>새 환자 추가</h2>
          <p className={styles.modalDescription}>
            이름과 환자코드를 입력해주세요.
          </p>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldItem}>
            <label className={styles.label}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              autoFocus
              className={styles.modalInput}
            />
          </div>
          <div className={styles.fieldItem}>
            <label className={styles.label}>환자코드</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: P00123"
              className={styles.modalInput}
            />
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={styles.submitButton}
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
