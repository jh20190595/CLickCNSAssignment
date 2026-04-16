"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  DateFormat,
  NumberSeparator,
} from "@/lib/settings";
import { serializeEvent } from "@/hooks/useHotkeys";

type Tab = "postprocess" | "audio" | "commands" | "shortcuts";

interface Props {
  open: boolean;
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "postprocess", label: "후처리" },
  { id: "audio", label: "오디오" },
  { id: "commands", label: "음성 명령어" },
  { id: "shortcuts", label: "단축키" },
];

export function SettingsModal({ open, settings, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("postprocess");

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
        className="bg-white rounded-lg shadow-xl w-[720px] max-w-[92vw] max-h-[86vh] overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="w-44 border-r border-slate-200 bg-slate-50 py-3">
          <div className="px-3 pb-2 text-xs font-semibold text-slate-500 tracking-wide">
            설정
          </div>
          <nav className="flex flex-col">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-left px-4 py-2 text-sm transition ${
                  tab === t.id
                    ? "bg-white text-slate-900 font-medium border-l-2 border-blue-500"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-sm"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

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
      <div className="text-sm font-semibold text-slate-800 mb-1">{title}</div>
      {description && (
        <div className="text-xs text-slate-500 mb-3">{description}</div>
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
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
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

function PostprocessTab({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const nc = settings.postprocess.numberCall;
  const update = (patch: Partial<typeof nc>) =>
    onChange({
      ...settings,
      postprocess: {
        ...settings.postprocess,
        numberCall: { ...nc, ...patch },
      },
    });
  const setDateFormat = (format: DateFormat) =>
    onChange({
      ...settings,
      postprocess: { ...settings.postprocess, dateFormat: format },
    });

  return (
    <>
      <Section
        title="번호 호출"
        description='"일/이/삼..." 순서대로 발화하면 1. 2. 3. 번호 매김으로 치환합니다.'
      >
        <Toggle
          checked={nc.enabled}
          onChange={(v) => update({ enabled: v })}
          label="번호 호출 사용"
        />
        <div className={nc.enabled ? "" : "opacity-40 pointer-events-none"}>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 w-20">구분기호</span>
            <select
              value={nc.separator}
              onChange={(e) =>
                update({ separator: e.target.value as NumberSeparator })
              }
              className="border border-slate-300 rounded px-2 py-1 text-sm"
            >
              <option value=".">1. (마침표)</option>
              <option value=")">1) (닫는 괄호)</option>
              <option value="-">1- (하이픈)</option>
            </select>
          </div>
          <div className="mt-3 space-y-2">
            <Toggle
              checked={nc.autoNewline}
              onChange={(v) => update({ autoNewline: v })}
              label="각 번호 앞에 줄바꿈 삽입"
            />
            <Toggle
              checked={nc.smallNumber}
              onChange={(v) => update({ smallNumber: v })}
              label="작은번호 스타일 ① ② ③"
            />
          </div>
        </div>
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
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="dateFormat"
                checked={settings.postprocess.dateFormat === v}
                onChange={() => setDateFormat(v)}
                className="accent-blue-600"
              />
              <span className="text-slate-700 font-mono">{ex}</span>
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
            className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            마이크 권한 허용하고 목록 불러오기
          </button>
        )}
        <select
          value={settings.audio.deviceId ?? ""}
          onChange={(e) => setDevice(e.target.value || null)}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
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
          <span className="text-sm font-mono text-slate-700 w-12 text-right">
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
            <span className="text-slate-600 w-24">녹음 종료</span>
            <input
              type="text"
              value={vc.stopWord}
              onChange={(e) => update({ stopWord: e.target.value })}
              placeholder="녹음 종료"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 text-sm mt-2">
            <span className="text-slate-600 w-24">줄바꿈</span>
            <input
              type="text"
              value={vc.newlineWord}
              onChange={(e) => update({ newlineWord: e.target.value })}
              placeholder="다음 줄"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      </Section>
    </>
  );
}

function ShortcutCapture({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [recording, setRecording] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600 w-24">{label}</span>
      <button
        type="button"
        onClick={() => {
          setRecording(true);
          setErrMsg(null);
        }}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return;
          e.preventDefault();
          if (e.key === "Escape") {
            setRecording(false);
            return;
          }
          const combo = serializeEvent(e.nativeEvent);
          if (!combo) {
            setErrMsg("수식키(Ctrl/Alt/Shift) + 키 조합이 필요합니다.");
            return;
          }
          onChange(combo);
          setRecording(false);
        }}
        className={`flex-1 border rounded px-3 py-1.5 font-mono text-left transition ${
          recording
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-slate-300 text-slate-700 hover:bg-slate-50"
        }`}
      >
        {recording ? "키 조합을 누르세요..." : value || "(설정 안 됨)"}
      </button>
      {errMsg && <span className="text-xs text-red-500">{errMsg}</span>}
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
    <Section title="단축키" description={notice}>
      <ShortcutCapture
        label="녹음 시작/정지"
        value={settings.shortcuts.toggleRecord}
        onChange={(v) => update({ toggleRecord: v })}
      />
      <ShortcutCapture
        label="줄바꿈 삽입"
        value={settings.shortcuts.newline}
        onChange={(v) => update({ newline: v })}
      />
    </Section>
  );
}
