const STORAGE_KEY = "soap.settings.v1";
const CHANGE_EVENT = "soap.settings.change";

export type DateFormat = "korean" | "iso" | "dot" | "english";
export type NumberSeparator = "." | ")" | "-";
export type VoiceAction = "stop" | "newline";

export type NumberCallOptions = {
  enabled: boolean;
  separator: NumberSeparator;
  autoNewline: boolean;
  smallNumber: boolean;
};

export type PostprocessSettings = {
  numberCall: NumberCallOptions;
  dateFormat: DateFormat;
};

export type AudioSettings = {
  deviceId: string | null;
  gain: number;
};

export type VoiceCommandSettings = {
  enabled: boolean;
  stopWord: string;
  newlineWord: string;
};

export type ShortcutSettings = {
  toggleRecord: string;
  newline: string;
};

export type AppSettings = {
  postprocess: PostprocessSettings;
  audio: AudioSettings;
  voiceCommands: VoiceCommandSettings;
  shortcuts: ShortcutSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  postprocess: {
    numberCall: {
      enabled: false,
      separator: ".",
      autoNewline: true,
      smallNumber: false,
    },
    dateFormat: "korean",
  },
  audio: {
    deviceId: null,
    gain: 1.0,
  },
  voiceCommands: {
    enabled: false,
    stopWord: "녹음 종료",
    newlineWord: "다음 줄",
  },
  shortcuts: {
    toggleRecord: "Ctrl+Shift+R",
    newline: "Ctrl+Enter",
  },
};

function merge<T>(base: T, patch: Partial<T> | undefined): T {
  if (!patch || typeof patch !== "object") return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const p = (patch as Record<string, unknown>)[key];
    const b = (base as Record<string, unknown>)[key];
    if (b && typeof b === "object" && !Array.isArray(b)) {
      out[key] = merge(b, p as Partial<typeof b>);
    } else if (p !== undefined) {
      out[key] = p;
    }
  }
  return out as T;
}

// useSyncExternalStore 의 getSnapshot 요구사항: 같은 외부 상태에 대해 같은 참조를 반환.
// localStorage 문자열이 바뀌지 않는 한 동일한 객체를 돌려준다.
let cachedRaw: string | null = null;
let cachedValue: AppSettings = DEFAULT_SETTINGS;

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    if (!raw) {
      cachedValue = DEFAULT_SETTINGS;
    } else {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      cachedValue = merge(DEFAULT_SETTINGS, parsed);
    }
    return cachedValue;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(settings);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  cachedRaw = serialized;
  cachedValue = settings;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeSettings(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
