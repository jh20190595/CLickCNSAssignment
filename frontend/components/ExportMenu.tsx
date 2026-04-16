"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient, SessionMeta, Soap } from "@/lib/types";
import {
  buildMarkdown,
  buildPlainText,
  downloadTextFile,
  filenameFor,
} from "@/lib/exportFormat";

interface ExportMenuProps {
  patient: Patient;
  meta: SessionMeta;
  soap: Soap;
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition-colors"
      >
        {copied ? "복사됨" : "내보내기 ▾"}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-44 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-10">
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
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
    >
      {children}
    </button>
  );
}
