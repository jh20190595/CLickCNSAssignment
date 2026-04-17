import type { Patient, PlanSections, SessionMeta, Soap } from "./types";
import { PLAN_LABELS, isPlanEmpty } from "./types";

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
    soap.chiefComplaint ? `- **주증상(CC)**: ${soap.chiefComplaint}` : null,
    `- **작성일**: ${formatDateTime(new Date())}`,
    ``,
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    sectionMd("S — Subjective", soap.subjective),
    sectionMd("O — Objective", soap.objective),
    sectionMd("A — Assessment", soap.assessment),
    planSectionMd(soap.plan),
  ].join("\n\n");

  const raw =
    rawTranscript && rawTranscript.trim()
      ? `\n\n---\n\n## 전체 대화\n\n${rawTranscript.trim()}\n`
      : "";

  return `${header}\n${sections}${raw}`;
}

export function buildPlainText(patient: Patient, meta: SessionMeta, soap: Soap): string {
  const ccSuffix = soap.chiefComplaint ? ` / CC: ${soap.chiefComplaint}` : "";
  const lines = [
    `[진료 기록]`,
    `환자: ${patient.name} (${patient.patientCode}) / ${meta.visitType}${ccSuffix}`,
    `작성일: ${formatDateTime(new Date())}`,
    ``,
    `[S] ${soap.subjective || "-"}`,
    ``,
    `[O] ${soap.objective || "-"}`,
    ``,
    `[A] ${soap.assessment || "-"}`,
    ``,
    `[P]`,
    ...planPlainLines(soap.plan),
  ];
  return lines.join("\n");
}

function sectionMd(title: string, body: string): string {
  return `## ${title}\n\n${body?.trim() || "_내용 없음_"}`;
}

function planSectionMd(plan: PlanSections): string {
  if (isPlanEmpty(plan)) {
    return `## P — Plan\n\n_내용 없음_`;
  }
  const parts: string[] = [`## P — Plan`, ``];
  (Object.keys(PLAN_LABELS) as Array<keyof PlanSections>).forEach((key) => {
    const body = plan[key]?.trim();
    if (!body) return;
    parts.push(`### ${PLAN_LABELS[key]}`, ``, body, ``);
  });
  return parts.join("\n").trimEnd();
}

function planPlainLines(plan: PlanSections): string[] {
  if (isPlanEmpty(plan)) return [`  -`];
  const lines: string[] = [];
  (Object.keys(PLAN_LABELS) as Array<keyof PlanSections>).forEach((key) => {
    const body = plan[key]?.trim();
    if (!body) return;
    lines.push(`  · ${PLAN_LABELS[key]}: ${body}`);
  });
  return lines.length ? lines : [`  -`];
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
