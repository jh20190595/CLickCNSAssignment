import type { Session, SessionMeta, Soap } from "./types";

const STORAGE_KEY = "soap.sessions.v2";

function readAll(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
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
}): string {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const session: Session = {
    id,
    patientId: input.patientId,
    createdAt: Date.now(),
    meta: input.meta,
    rawTranscript: input.rawTranscript,
    soap: input.soap,
  };
  writeAll([session, ...readAll()]);
  return id;
}

export function updateSession(
  id: string,
  patch: Partial<Pick<Session, "rawTranscript" | "soap" | "meta">>,
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
