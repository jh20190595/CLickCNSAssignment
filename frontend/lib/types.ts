export type VisitType = "초진" | "재진";

export type Patient = {
  id: string;
  name: string;
  patientCode: string;
  createdAt: number;
};

export type SessionMeta = {
  visitType: VisitType;
  chiefComplaint: string;
};

export type Soap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type Session = {
  id: string;
  patientId: string;
  createdAt: number;
  meta: SessionMeta;
  rawTranscript: string;
  soap: Soap;
};

export const EMPTY_SOAP: Soap = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

export const DEFAULT_SESSION_META: SessionMeta = {
  visitType: "초진",
  chiefComplaint: "",
};
