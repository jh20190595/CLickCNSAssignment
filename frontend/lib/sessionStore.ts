import type {
  PlanSections,
  Session,
  SessionMeta,
  Soap,
  Utterance,
} from "./types";
import { EMPTY_PLAN } from "./types";

const STORAGE_KEY = "soap.sessions.v3";
const LEGACY_KEY_V2 = "soap.sessions.v2";

type LegacyV2Meta = {
  visitType: "초진" | "재진";
  chiefComplaint?: string;
};
type LegacyV2Soap = {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
};
type LegacyV2Session = {
  id: string;
  patientId: string;
  createdAt: number;
  meta: LegacyV2Meta;
  rawTranscript: string;
  soap: LegacyV2Soap;
};

function migrateV2Plan(legacyPlan: string | undefined): PlanSections {
  const text = (legacyPlan ?? "").trim();
  if (!text) return { ...EMPTY_PLAN };
  return { ...EMPTY_PLAN, medication: text };
}

function migrateV2Session(s: LegacyV2Session): Session {
  return {
    id: s.id,
    patientId: s.patientId,
    createdAt: s.createdAt,
    meta: { visitType: s.meta.visitType },
    rawTranscript: s.rawTranscript,
    soap: {
      chiefComplaint: s.meta.chiefComplaint ?? "",
      subjective: s.soap?.subjective ?? "",
      objective: s.soap?.objective ?? "",
      assessment: s.soap?.assessment ?? "",
      plan: migrateV2Plan(s.soap?.plan),
    },
  };
}

function migrateFromV2IfNeeded(): Session[] | null {
  if (typeof window === "undefined") return null;
  const legacy = window.localStorage.getItem(LEGACY_KEY_V2);
  if (!legacy) return null;
  try {
    const parsed = JSON.parse(legacy) as LegacyV2Session[];
    if (!Array.isArray(parsed)) return null;
    const migrated = parsed.map(migrateV2Session);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_KEY_V2);
    return migrated;
  } catch {
    return null;
  }
}

function readAll(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateFromV2IfNeeded() ?? [];
    }
    const parsed = JSON.parse(raw) as Session[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: Session[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function listSessions(): Session[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function listSessionsByPatient(patientId: string): Session[] {
  return readAll()
    .filter((s) => s.patientId === patientId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSession(input: {
  patientId: string;
  meta: SessionMeta;
  rawTranscript: string;
  soap: Soap;
  segments?: Utterance[];
}): string {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const session: Session = {
    id,
    patientId: input.patientId,
    createdAt: Date.now(),
    meta: input.meta,
    rawTranscript: input.rawTranscript,
    soap: input.soap,
    segments: input.segments,
  };
  writeAll([session, ...readAll()]);
  return id;
}

export function updateSession(
  id: string,
  patch: Partial<Pick<Session, "rawTranscript" | "soap" | "meta" | "segments">>,
) {
  const sessions = readAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...patch };
  writeAll(sessions);
}

export function deleteSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function deleteSessionsByPatient(patientId: string) {
  writeAll(readAll().filter((s) => s.patientId !== patientId));
}

export function getSession(id: string): Session | null {
  return readAll().find((s) => s.id === id) ?? null;
}
