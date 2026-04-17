export type VisitType = "초진" | "재진";

export type SpeakerLabel = "doctor" | "patient";

export type Utterance = {
  speaker: SpeakerLabel;
  text: string;
};

export const SPEAKER_KOREAN: Record<SpeakerLabel, string> = {
  doctor: "의사",
  patient: "환자",
};

export type Patient = {
  id: string;
  name: string;
  patientCode: string;
  createdAt: number;
};

export type SessionMeta = {
  visitType: VisitType;
};

export type PlanSections = {
  medication: string;
  exam: string;
  education: string;
  followup: string;
};

export type Soap = {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: PlanSections;
};

export type Session = {
  id: string;
  patientId: string;
  createdAt: number;
  meta: SessionMeta;
  rawTranscript: string;
  soap: Soap;
  /** 화자 라벨링 결과 (옵션 활성화 시만 존재) */
  segments?: Utterance[];
};

export const EMPTY_PLAN: PlanSections = {
  medication: "",
  exam: "",
  education: "",
  followup: "",
};

export const EMPTY_SOAP: Soap = {
  chiefComplaint: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: { ...EMPTY_PLAN },
};

export const DEFAULT_SESSION_META: SessionMeta = {
  visitType: "초진",
};

export const PLAN_LABELS: Record<keyof PlanSections, string> = {
  medication: "처방/약물",
  exam: "검사/오더",
  education: "환자 교육",
  followup: "추후/재방문",
};

export function isPlanEmpty(plan: PlanSections): boolean {
  return !plan.medication && !plan.exam && !plan.education && !plan.followup;
}

export function isSoapEmpty(soap: Soap): boolean {
  return (
    !soap.chiefComplaint &&
    !soap.subjective &&
    !soap.objective &&
    !soap.assessment &&
    isPlanEmpty(soap.plan)
  );
}
