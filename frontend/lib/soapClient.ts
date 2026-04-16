import type { Patient, SessionMeta, Soap } from "@/lib/types";
import { EMPTY_SOAP } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function classifySoap(
  transcript: string,
  patient: Patient,
  meta: SessionMeta,
): Promise<Soap> {
  if (!transcript.trim()) return EMPTY_SOAP;

  const res = await fetch(`${BACKEND_URL}/llm/soap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      meta: {
        patientLabel: `${patient.name} (${patient.patientCode})`,
        visitType: meta.visitType,
        chiefComplaint: meta.chiefComplaint,
      },
    }),
  });

  if (!res.ok) {
    const detail = await safeText(res);
    throw new Error(`SOAP 분류 실패 (${res.status}) ${detail}`);
  }

  const data = (await res.json()) as Partial<Soap>;
  return {
    subjective: data.subjective ?? "",
    objective: data.objective ?? "",
    assessment: data.assessment ?? "",
    plan: data.plan ?? "",
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
