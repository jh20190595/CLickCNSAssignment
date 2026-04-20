"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient, SessionMeta, Soap } from "@/lib/types";
import {
  buildMarkdown,
  buildPlainText,
  downloadTextFile,
  filenameFor,
} from "@/lib/exportFormat";
import styles from "./ExportMenu.module.css";

interface ExportMenuProps {
  /** 파일명(`filenameFor`)과 출력 머리말에 들어갈 환자 정보 */
  patient: Patient;
  /** 출력에 포함할 초진/재진 + 주증상 */
  meta: SessionMeta;
  /** 본문이 될 S/O/A/P 값 */
  soap: Soap;
  /** MD 파일 다운로드 시 말미에 덧붙일 원본 전사 */
  rawTranscript: string;
}

export function ExportMenu({ patient, meta, soap, rawTranscript }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function copyMarkdown() {
    const md = buildMarkdown(patient, meta, soap);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  }

  function downloadMd() {
    downloadTextFile(
      filenameFor(patient, "md"),
      buildMarkdown(patient, meta, soap, rawTranscript),
      "text/markdown",
    );
    setOpen(false);
  }

  function downloadTxt() {
    downloadTextFile(
      filenameFor(patient, "txt"),
      buildPlainText(patient, meta, soap),
      "text/plain",
    );
    setOpen(false);
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={styles.button}
      >
        {copied ? "복사됨" : "내보내기 ▾"}
      </button>
      {open && (
        <div className={styles.dropdown}>
          <MenuItem onClick={copyMarkdown}>전체 복사 (Markdown)</MenuItem>
          <MenuItem onClick={downloadMd}>Markdown 파일</MenuItem>
          <MenuItem onClick={downloadTxt}>TXT 파일</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  /** 메뉴 항목 클릭 시 호출 (복사/다운로드 액션) */
  onClick: () => void;
  /** 항목 라벨 텍스트 */
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={styles.menuItem}
    >
      {children}
    </button>
  );
}
