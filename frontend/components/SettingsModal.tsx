"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppSettings, DateFormat, ShortcutSettings, ThemeMode } from "@/lib/settings";
import { serializeEvent } from "@/hooks/useHotkeys";

type Tab = "theme" | "postprocess" | "audio" | "commands" | "shortcuts";

interface Props {
  /** true면 모달 렌더. false면 null 반환해 언마운트 */
  open: boolean;
  /** 현재 앱 설정 스냅샷. useSettings의 외부 스토어와 연결된 값 */
  settings: AppSettings;
  /** 설정 변경 즉시 호출 (디바운스 없음). saveSettings 까지 이어짐 */
  onChange: (next: AppSettings) => void;
  /** 배경 클릭 / ✕ / Esc 키에 연결 */
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "theme", label: "테마" },
  { id: "postprocess", label: "후처리" },
  { id: "audio", label: "오디오" },
  { id: "commands", label: "음성 명령어" },
  { id: "shortcuts", label: "단축키" },
];

export function SettingsModal({ open, settings, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("theme");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[720px] max-w-[92vw] max-h-[86vh] overflow-hidden flex dark:bg-slate-900 dark:border dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="w-44 border-r border-slate-200 bg-slate-50 py-3 flex flex-col dark:bg-slate-950 dark:border-slate-800">
          <div className="px-3 pb-2 text-xs font-semibold text-slate-500 tracking-wide dark:text-slate-400">
            설정
          </div>
          <nav className="flex flex-col flex-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-left px-4 py-2 text-sm transition ${
                  tab === t.id
                    ? "bg-white text-slate-900 font-medium border-l-2 border-blue-500 dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-sm dark:hover:text-slate-200"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {tab === "theme" && (
            <ThemeTab settings={settings} onChange={onChange} />
          )}
          {tab === "postprocess" && (
            <PostprocessTab settings={settings} onChange={onChange} />
          )}
          {tab === "audio" && <AudioTab settings={settings} onChange={onChange} />}
          {tab === "commands" && (
            <CommandsTab settings={settings} onChange={onChange} />
          )}
          {tab === "shortcuts" && (
            <ShortcutsTab settings={settings} onChange={onChange} />
          )}
        </section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="text-sm font-semibold text-slate-800 mb-1 dark:text-slate-100">{title}</div>
      {description && (
        <div className="text-xs text-slate-500 mb-3 dark:text-slate-400">{description}</div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none dark:text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-600"
      />
      {label}
    </label>
  );
}

function ThemeTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const setTheme = (theme: ThemeMode) => onChange({ ...settings, theme });
  const options: { v: ThemeMode; label: string; hint: string }[] = [
    { v: "light", label: "기본", hint: "밝은 배경 · 진료 현장에서 보기 좋음" },
    { v: "dark", label: "다크모드", hint: "어두운 배경 · 장시간 화면 보기 편함" },
  ];

  return (
    <Section
      title="외관 테마"
      description="앱 전반에 적용됩니다. 변경은 즉시 반영되고 설정은 브라우저에 저장됩니다."
    >
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ v, label, hint }) => (
          <label
            key={v}
            className={`flex flex-col gap-1 border rounded px-3 py-2.5 text-sm cursor-pointer transition ${
              settings.theme === v
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-400"
                : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                checked={settings.theme === v}
                onChange={() => setTheme(v)}
                className="accent-blue-600"
              />
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {label}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 pl-6">
              {hint}
            </span>
          </label>
        ))}
      </div>
    </Section>
  );
}

function PostprocessTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const setDateFormat = (format: DateFormat) =>
    onChange({
      ...settings,
      postprocess: { ...settings.postprocess, dateFormat: format },
    });

  const setSpeakerLabel = (enabled: boolean) =>
    onChange({
      ...settings,
      postprocess: { ...settings.postprocess, speakerLabel: enabled },
    });

  return (
    <>
      <Section
        title="화자 라벨링"
        description="녹음 종료 후 LLM으로 각 발화의 화자(의사/환자)를 추정합니다. 추가 LLM 호출 비용이 발생합니다."
      >
        <Toggle
          checked={settings.postprocess.speakerLabel}
          onChange={setSpeakerLabel}
          label="화자 라벨링 사용"
        />
      </Section>

      <Section
        title="날짜 형식"
        description="연·월·일이 모두 인식됐을 때 이 형식으로 출력됩니다."
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: "korean", ex: "2026년 4월 16일" },
              { v: "iso", ex: "2026-04-16" },
              { v: "dot", ex: "2026.04.16" },
              { v: "english", ex: "Apr 16, 2026" },
            ] as { v: DateFormat; ex: string }[]
          ).map(({ v, ex }) => (
            <label
              key={v}
              className={`flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer transition ${
                settings.postprocess.dateFormat === v
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-400"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40"
              }`}
            >
              <input
                type="radio"
                name="dateFormat"
                checked={settings.postprocess.dateFormat === v}
                onChange={() => setDateFormat(v)}
                className="accent-blue-600"
              />
              <span className="text-slate-700 font-mono dark:text-slate-200">{ex}</span>
            </label>
          ))}
        </div>
      </Section>
    </>
  );
}

function AudioTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const inputs = list.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        // label이 비어있으면 아직 getUserMedia 권한이 없는 상태
        if (inputs.every((d) => !d.label)) setNeedsPermission(true);
      } catch {
        /* ignore */
      }
    }
    load();
    const onChangeDevices = () => load();
    navigator.mediaDevices?.addEventListener?.("devicechange", onChangeDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        onChangeDevices,
      );
    };
  }, []);

  async function requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));
      setNeedsPermission(false);
    } catch {
      /* ignore */
    }
  }

  const setDevice = (id: string | null) =>
    onChange({ ...settings, audio: { ...settings.audio, deviceId: id } });
  const setGain = (g: number) =>
    onChange({ ...settings, audio: { ...settings.audio, gain: g } });

  return (
    <>
      <Section
        title="입력 장치"
        description="사용할 마이크를 선택합니다. 선택 변경은 다음 녹음부터 적용됩니다."
      >
        {needsPermission && (
          <button
            type="button"
            onClick={requestPermission}
            className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            마이크 권한 허용하고 목록 불러오기
          </button>
        )}
        <select
          value={settings.audio.deviceId ?? ""}
          onChange={(e) => setDevice(e.target.value || null)}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
        >
          <option value="">시스템 기본 장치</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `마이크 (${d.deviceId.slice(0, 6)})`}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="마이크 게인"
        description="0.5x ~ 3.0x 사이 배율. 녹음 중 실시간으로 반영됩니다."
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.audio.gain}
            onChange={(e) => setGain(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-mono text-slate-700 w-12 text-right dark:text-slate-200">
            {settings.audio.gain.toFixed(1)}x
          </span>
        </div>
      </Section>
    </>
  );
}

function CommandsTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const vc = settings.voiceCommands;
  const update = (patch: Partial<typeof vc>) =>
    onChange({ ...settings, voiceCommands: { ...vc, ...patch } });

  return (
    <>
      <Section
        title="음성 명령어"
        description="녹음 중 지정 단어가 발화되면 자동 액션이 실행됩니다. 해당 단어는 최종 기록에서 제거됩니다."
      >
        <Toggle
          checked={vc.enabled}
          onChange={(v) => update({ enabled: v })}
          label="음성 명령어 사용"
        />
        <div className={vc.enabled ? "" : "opacity-40 pointer-events-none"}>
          <div className="flex items-center gap-3 text-sm mt-3">
            <span className="text-slate-600 w-24 dark:text-slate-300">녹음 종료</span>
            <input
              type="text"
              value={vc.stopWord}
              onChange={(e) => update({ stopWord: e.target.value })}
              placeholder="녹음 종료"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="flex items-center gap-3 text-sm mt-2">
            <span className="text-slate-600 w-24 dark:text-slate-300">줄바꿈</span>
            <input
              type="text"
              value={vc.newlineWord}
              onChange={(e) => update({ newlineWord: e.target.value })}
              placeholder="다음 줄"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      </Section>
    </>
  );
}

const SHORTCUT_LABELS: Record<keyof ShortcutSettings, string> = {
  toggleRecord: "녹음 시작/정지",
  newline: "줄바꿈 삽입",
  copyCC: "CC 복사",
  copyS: "S 복사",
  copyO: "O 복사",
  copyA: "A 복사",
  copyP: "P 복사",
};

function ShortcutCapture({
  value,
  onChange,
  label,
  allShortcuts,
  currentKey,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  allShortcuts: ShortcutSettings;
  currentKey: keyof ShortcutSettings;
}) {
  const [recording, setRecording] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      // 수식키 단독 입력은 무시 (조합 완성 대기)
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      const combo = serializeEvent(e);
      if (!combo) {
        setErrMsg("수식키(Ctrl/Alt/Shift) + 키 조합이 필요합니다.");
        return;
      }
      const conflictField = (Object.keys(allShortcuts) as (keyof ShortcutSettings)[])
        .find((k) => k !== currentKey && allShortcuts[k] === combo);
      if (conflictField) {
        setErrMsg(`이미 "${SHORTCUT_LABELS[conflictField]}"에 할당된 단축키입니다.`);
        setRecording(false);
        return;
      }
      onChange(combo);
      setRecording(false);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600 w-24 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => {
          setRecording((r) => !r);
          setErrMsg(null);
        }}
        className={`flex-1 border rounded px-3 py-1.5 font-mono text-left transition ${
          recording
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
            : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        }`}
      >
        {recording ? "키 조합을 누르세요... (Esc 취소)" : value || "(설정 안 됨)"}
      </button>
      {errMsg && <span className="text-xs text-red-500 dark:text-red-400">{errMsg}</span>}
    </div>
  );
}

function ShortcutsTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const update = (patch: Partial<typeof settings.shortcuts>) =>
    onChange({
      ...settings,
      shortcuts: { ...settings.shortcuts, ...patch },
    });

  const notice = useMemo(
    () =>
      "앱에 포커스가 있을 때만 동작합니다. 텍스트 입력 중에는 일부 단축키가 무시될 수 있습니다.",
    [],
  );

  return (
    <>
      <Section title="녹음 제어" description={notice}>
        <ShortcutCapture
          label="녹음 시작/정지"
          value={settings.shortcuts.toggleRecord}
          onChange={(v) => update({ toggleRecord: v })}
          allShortcuts={settings.shortcuts}
          currentKey="toggleRecord"
        />
        <ShortcutCapture
          label="줄바꿈 삽입"
          value={settings.shortcuts.newline}
          onChange={(v) => update({ newline: v })}
          allShortcuts={settings.shortcuts}
          currentKey="newline"
        />
      </Section>
      <Section
        title="섹션 복사"
        description="편집 중에도 동작합니다. 클립보드에 해당 섹션의 텍스트를 복사합니다."
      >
        <ShortcutCapture
          label="CC 복사"
          value={settings.shortcuts.copyCC}
          onChange={(v) => update({ copyCC: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyCC"
        />
        <ShortcutCapture
          label="S 복사"
          value={settings.shortcuts.copyS}
          onChange={(v) => update({ copyS: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyS"
        />
        <ShortcutCapture
          label="O 복사"
          value={settings.shortcuts.copyO}
          onChange={(v) => update({ copyO: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyO"
        />
        <ShortcutCapture
          label="A 복사"
          value={settings.shortcuts.copyA}
          onChange={(v) => update({ copyA: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyA"
        />
        <ShortcutCapture
          label="P 복사"
          value={settings.shortcuts.copyP}
          onChange={(v) => update({ copyP: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyP"
        />
      </Section>
    </>
  );
}
