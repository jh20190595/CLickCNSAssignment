"use client";

import { useEffect, useRef, useState } from 'react';

import type { Patient, SessionMeta, Soap } from '@/lib/types';
import {
  buildMarkdown,
  buildPlainText,
  downloadTextFile,
  filenameFor,
} from '@/lib/exportFormat';

import styles from './ExportMenu.module.css';

interface Props {
  patient: Patient;
  meta: SessionMeta;
  soap: Soap;
  rawTranscript: string;
}

export default function ExportMenu({ patient, meta, soap, rawTranscript }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleCopyMarkdown() {
    const md = buildMarkdown(patient, meta, soap);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  }

  function handleDownloadMd() {
    downloadTextFile(
      filenameFor(patient, 'md'),
      buildMarkdown(patient, meta, soap, rawTranscript),
      'text/markdown',
    );
    setOpen(false);
  }

  function handleDownloadTxt() {
    downloadTextFile(
      filenameFor(patient, 'txt'),
      buildPlainText(patient, meta, soap),
      'text/plain',
    );
    setOpen(false);
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={styles.button}
      >
        {copied ? '복사됨' : '내보내기 ▾'}
      </button>
      {open && (
        <div className={styles.dropdown}>
          <MenuItem onClick={handleCopyMarkdown}>전체 복사 (Markdown)</MenuItem>
          <MenuItem onClick={handleDownloadMd}>Markdown 파일</MenuItem>
          <MenuItem onClick={handleDownloadTxt}>TXT 파일</MenuItem>
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
      className={styles.menuItem}
    >
      {children}
    </button>
  );
}
