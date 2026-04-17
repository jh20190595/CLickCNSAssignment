import type {
  Patient,
  PlanSections,
  SessionMeta,
  Soap,
  Utterance,
} from "@/lib/types";
import { EMPTY_PLAN, EMPTY_SOAP } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function classifySoap(
  transcript: string,
  patient: Patient,
  meta: SessionMeta,
  hintChiefComplaint?: string,
  segments?: Utterance[],
): Promise<Soap> {
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  if (!transcript.trim() && !hasSegments) {
    return { ...EMPTY_SOAP, plan: { ...EMPTY_PLAN } };
  }

  const res = await fetch(`${BACKEND_URL}/llm/soap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      segments: hasSegments ? segments : undefined,
      meta: {
        patientLabel: `${patient.name} (${patient.patientCode})`,
        visitType: meta.visitType,
        chiefComplaint: hintChiefComplaint ?? "",
      },
    }),
  });

  if (!res.ok) {
    const detail = await safeText(res);
    throw new Error(`SOAP 분류 실패 (${res.status}) ${detail}`);
  }

  const data = (await res.json()) as Partial<Soap> & { plan?: unknown };
  return {
    chiefComplaint: data.chiefComplaint ?? "",
    subjective: data.subjective ?? "",
    objective: data.objective ?? "",
    assessment: data.assessment ?? "",
    plan: coercePlan(data.plan),
  };
}

function coercePlan(raw: unknown): PlanSections {
  if (typeof raw === "string") {
    return { ...EMPTY_PLAN, medication: raw };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Partial<Record<keyof PlanSections, unknown>>;
    return {
      medication: String(r.medication ?? ""),
      exam: String(r.exam ?? ""),
      education: String(r.education ?? ""),
      followup: String(r.followup ?? ""),
    };
  }
  return { ...EMPTY_PLAN };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
