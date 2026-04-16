import type { VoiceAction, VoiceCommandSettings } from "@/lib/settings";

export type VoiceMatch = {
  action: VoiceAction;
  cleanedText: string;
};

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripSuffix(text: string, suffix: string): string | null {
  const norm = normalize(text);
  const target = normalize(suffix);
  if (!target) return null;
  if (!norm.endsWith(target)) return null;
  // 원본 끝에서 (공백 무시) target 만큼 잘라낸다.
  const lower = text.toLowerCase();
  const idx = lower.lastIndexOf(target[target.length - 1]);
  if (idx < 0) return null;
  // 단순히 원본에서 suffix 길이만큼 뒤를 자르되, trailing whitespace 포함 제거
  let cut = text.length;
  let remaining = target.length;
  while (cut > 0 && remaining > 0) {
    cut--;
    const ch = text[cut];
    if (/\s/.test(ch)) continue;
    remaining--;
  }
  return text.slice(0, cut).replace(/\s+$/, "");
}

export function detectCommand(
  text: string,
  cfg: VoiceCommandSettings,
): VoiceMatch | null {
  if (!cfg.enabled || !text) return null;

  const stopCleaned = cfg.stopWord ? stripSuffix(text, cfg.stopWord) : null;
  if (stopCleaned !== null) {
    return { action: "stop", cleanedText: stopCleaned };
  }

  const newlineCleaned = cfg.newlineWord
    ? stripSuffix(text, cfg.newlineWord)
    : null;
  if (newlineCleaned !== null) {
    return { action: "newline", cleanedText: newlineCleaned };
  }

  return null;
}
