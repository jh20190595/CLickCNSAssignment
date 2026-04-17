import { useEffect, useRef } from "react";

type HotkeyMap = Record<string, (() => void) | undefined>;

type Options = {
  /** 단축키 동작을 폼 필드 안에서도 허용할 화이트리스트 (조합 문자열) */
  allowInEditable?: string[];
};

export function parseCombo(combo: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
} | null {
  if (!combo) return null;
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const mods = { ctrl: false, alt: false, shift: false, meta: false };
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "control") mods.ctrl = true;
    else if (p === "alt") mods.alt = true;
    else if (p === "shift") mods.shift = true;
    else if (p === "meta" || p === "cmd" || p === "command") mods.meta = true;
    else key = p;
  }
  if (!key) return null;
  return { ...mods, key };
}

function keyFromCode(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Backquote: "`", Minus: "-", Equal: "=",
    BracketLeft: "[", BracketRight: "]", Backslash: "\\",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Backspace",
    Delete: "Delete", Escape: "Escape",
    ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
  };
  if (map[code]) return map[code];
  if (code.startsWith("F") && /^F\d+$/.test(code)) return code;
  return null;
}

export function serializeEvent(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  const key = keyFromCode(e.code);
  if (!key) return null;
  parts.push(key);
  if (parts.length < 2) return null;
  return parts.join("+");
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

function matches(combo: string, e: KeyboardEvent): boolean {
  const parsed = parseCombo(combo);
  if (!parsed) return false;
  if (parsed.ctrl !== e.ctrlKey) return false;
  if (parsed.alt !== e.altKey) return false;
  if (parsed.shift !== e.shiftKey) return false;
  if (parsed.meta !== e.metaKey) return false;
  const physical = keyFromCode(e.code);
  if (physical && physical.toLowerCase() === parsed.key) return true;
  return parsed.key === e.key.toLowerCase();
}

export function useHotkeys(bindings: HotkeyMap, options: Options = {}) {
  const bindingsRef = useRef(bindings);
  const allowRef = useRef(options.allowInEditable ?? []);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);
  useEffect(() => {
    allowRef.current = options.allowInEditable ?? [];
  }, [options.allowInEditable]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const editable = isEditable(e.target);
      for (const [combo, cb] of Object.entries(bindingsRef.current)) {
        if (!cb || !combo) continue;
        if (!matches(combo, e)) continue;
        if (editable && !allowRef.current.includes(combo)) continue;
        e.preventDefault();
        cb();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
