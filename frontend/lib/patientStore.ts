import type { Patient } from "./types";

const STORAGE_KEY = "soap.patients.v1";

function readAll(): Patient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Patient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(patients: Patient[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export function listPatients(): Patient[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getPatient(id: string): Patient | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function createPatient(input: { name: string; patientCode: string }): Patient {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const patient: Patient = {
    id,
    name: input.name.trim(),
    patientCode: input.patientCode.trim(),
    createdAt: Date.now(),
  };
  writeAll([patient, ...readAll()]);
  return patient;
}

export function deletePatient(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function searchPatients(query: string): Patient[] {
  const q = query.trim().toLowerCase();
  const all = listPatients();
  if (!q) return all;
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q),
  );
}
