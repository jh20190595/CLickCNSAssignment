import type { Patient, SessionMeta, Soap } from "./types";

export function buildMarkdown(
  patient: Patient,
  meta: SessionMeta,
  soap: Soap,
  rawTranscript?: string,
): string {
  const header = [
    `# 진료 기록`,
    ``,
    `- **환자**: ${patient.name} (${patient.patientCode})`,
    `- **방문 유형**: ${meta.visitType}`,
    meta.chiefComplaint ? `- **주증상**: ${meta.chiefComplaint}` : null,
    `- **작성일**: ${formatDateTime(new Date())}`,
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    sectionMd("S — Subjective", soap.subjective),
    sectionMd("O — Objective", soap.objective),
    sectionMd("A — Assessment", soap.assessment),
    sectionMd("P — Plan", soap.plan),
  ].join("\n\n");

  const raw =
    rawTranscript && rawTranscript.trim()
      ? `\n\n---\n\n## 원본 전사\n\n${rawTranscript.trim()}\n`
      : "";

  return `${header}\n${sections}${raw}`;
}

export function buildPlainText(patient: Patient, meta: SessionMeta, soap: Soap): string {
  const lines = [
    `[진료 기록]`,
    `환자: ${patient.name} (${patient.patientCode}) / ${meta.visitType}${meta.chiefComplaint ? ` / ${meta.chiefComplaint}` : ""}`,
    `작성일: ${formatDateTime(new Date())}`,
    ``,
    `[S] ${soap.subjective || "-"}`,
    ``,
    `[O] ${soap.objective || "-"}`,
    ``,
    `[A] ${soap.assessment || "-"}`,
    ``,
    `[P] ${soap.plan || "-"}`,
  ];
  return lines.join("\n");
}

function sectionMd(title: string, body: string): string {
  return `## ${title}\n\n${body?.trim() || "_내용 없음_"}`;
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function filenameFor(patient: Patient, ext: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const code = patient.patientCode.replace(/[^A-Za-z0-9가-힣]/g, "") || "session";
  return `soap_${code}_${stamp}.${ext}`;
}
