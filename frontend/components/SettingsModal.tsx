'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AppSettings, DateFormat, ShortcutSettings, ThemeMode } from '@/lib/settings';
import { serializeEvent } from '@/hooks/useHotkeys';
import styles from './SettingsModal.module.css';

type Tab = 'theme' | 'postprocess' | 'audio' | 'commands' | 'shortcuts';

interface Props {
  open: boolean;
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'theme', label: '테마' },
  { id: 'postprocess', label: '후처리' },
  { id: 'audio', label: '오디오' },
  { id: 'commands', label: '음성 명령어' },
  { id: 'shortcuts', label: '단축키' },
];

export default function SettingsModal({ open, settings, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('theme');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>
            설정
          </div>
          <nav className={styles.sidebarNav}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={tab === t.id ? styles.tabActive : styles.tabInactive}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className={styles.version}>
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.headerRow}>
            <h2 className={styles.title}>
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {tab === 'theme' && (
            <ThemeTab settings={settings} onChange={onChange} />
          )}
          {tab === 'postprocess' && (
            <PostprocessTab settings={settings} onChange={onChange} />
          )}
          {tab === 'audio' && <AudioTab settings={settings} onChange={onChange} />}
          {tab === 'commands' && (
            <CommandsTab settings={settings} onChange={onChange} />
          )}
          {tab === 'shortcuts' && (
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
    <div className={styles.sectionWrapper}>
      <div className={styles.sectionTitle}>{title}</div>
      {description && (
        <div className={styles.sectionDescription}>{description}</div>
      )}
      <div className={styles.sectionChildren}>{children}</div>
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
    <label className={styles.toggleLabel}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.checkbox}
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
  const handleTheme = (theme: ThemeMode) => onChange({ ...settings, theme });
  const options: { v: ThemeMode; label: string; hint: string }[] = [
    { v: 'light', label: '기본', hint: '밝은 배경 · 진료 현장에서 보기 좋음' },
    { v: 'dark', label: '다크모드', hint: '어두운 배경 · 장시간 화면 보기 편함' },
  ];

  return (
    <Section
      title="외관 테마"
      description="앱 전반에 적용됩니다. 변경은 즉시 반영되고 설정은 브라우저에 저장됩니다."
    >
      <div className={styles.themeGrid}>
        {options.map(({ v, label, hint }) => (
          <label
            key={v}
            className={settings.theme === v ? styles.cardActive : styles.cardInactive}
          >
            <div className={styles.radioRow}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === v}
                onChange={() => handleTheme(v)}
                className={styles.radio}
              />
              <span className={styles.labelText}>
                {label}
              </span>
            </div>
            <span className={styles.hint}>
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
  const handleDateFormat = (format: DateFormat) =>
    onChange({
      ...settings,
      postprocess: { ...settings.postprocess, dateFormat: format },
    });

  const handleSpeakerLabel = (enabled: boolean) =>
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
          onChange={handleSpeakerLabel}
          label="화자 라벨링 사용"
        />
      </Section>

      <Section
        title="날짜 형식"
        description="연·월·일이 모두 인식됐을 때 이 형식으로 출력됩니다."
      >
        <div className={styles.themeGrid}>
          {(
            [
              { v: 'korean', ex: '2026년 4월 16일' },
              { v: 'iso', ex: '2026-04-16' },
              { v: 'dot', ex: '2026.04.16' },
              { v: 'english', ex: 'Apr 16, 2026' },
            ] as { v: DateFormat; ex: string }[]
          ).map(({ v, ex }) => (
            <label
              key={v}
              className={
                settings.postprocess.dateFormat === v
                  ? styles.dateCardActive
                  : styles.dateCardInactive
              }
            >
              <input
                type="radio"
                name="dateFormat"
                checked={settings.postprocess.dateFormat === v}
                onChange={() => handleDateFormat(v)}
                className={styles.radio}
              />
              <span className={styles.fontMono}>{ex}</span>
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
        const inputs = list.filter((d) => d.kind === 'audioinput');
        setDevices(inputs);
        if (inputs.every((d) => !d.label)) setNeedsPermission(true);
      } catch {
        /* ignore */
      }
    }
    load();
    const handleDeviceChange = () => load();
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        handleDeviceChange,
      );
    };
  }, []);

  async function handleRequestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'audioinput'));
      setNeedsPermission(false);
    } catch {
      /* ignore */
    }
  }

  const handleDevice = (id: string | null) =>
    onChange({ ...settings, audio: { ...settings.audio, deviceId: id } });
  const handleGain = (g: number) =>
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
            onClick={handleRequestPermission}
            className={styles.permissionButton}
          >
            마이크 권한 허용하고 목록 불러오기
          </button>
        )}
        <select
          value={settings.audio.deviceId ?? ''}
          onChange={(e) => handleDevice(e.target.value || null)}
          className={styles.select}
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
        <div className={styles.gainRow}>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.audio.gain}
            onChange={(e) => handleGain(Number(e.target.value))}
            className={styles.range}
          />
          <span className={styles.gainValue}>
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
  const handleUpdate = (patch: Partial<typeof vc>) =>
    onChange({ ...settings, voiceCommands: { ...vc, ...patch } });

  return (
    <>
      <Section
        title="음성 명령어"
        description="녹음 중 지정 단어가 발화되면 자동 액션이 실행됩니다. 해당 단어는 최종 기록에서 제거됩니다."
      >
        <Toggle
          checked={vc.enabled}
          onChange={(v) => handleUpdate({ enabled: v })}
          label="음성 명령어 사용"
        />
        <div className={vc.enabled ? undefined : styles.disabledWrapper}>
          <div className={styles.commandRow}>
            <span className={styles.commandLabel}>녹음 종료</span>
            <input
              type="text"
              value={vc.stopWord}
              onChange={(e) => handleUpdate({ stopWord: e.target.value })}
              placeholder="녹음 종료"
              className={styles.commandInput}
            />
          </div>
          <div className={styles.commandRowSmall}>
            <span className={styles.commandLabel}>줄바꿈</span>
            <input
              type="text"
              value={vc.newlineWord}
              onChange={(e) => handleUpdate({ newlineWord: e.target.value })}
              placeholder="다음 줄"
              className={styles.commandInput}
            />
          </div>
        </div>
      </Section>
    </>
  );
}

const SHORTCUT_LABELS: Record<keyof ShortcutSettings, string> = {
  toggleRecord: '녹음 시작/정지',
  newline: '줄바꿈 삽입',
  copyCC: 'CC 복사',
  copyS: 'S 복사',
  copyO: 'O 복사',
  copyA: 'A 복사',
  copyP: 'P 복사',
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
      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      const combo = serializeEvent(e);
      if (!combo) {
        setErrMsg('수식키(Ctrl/Alt/Shift) + 키 조합이 필요합니다.');
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
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [recording, onChange]);

  return (
    <div className={styles.shortcutRow}>
      <span className={styles.shortcutLabel}>{label}</span>
      <button
        type="button"
        onClick={() => {
          setRecording((r) => !r);
          setErrMsg(null);
        }}
        className={recording ? styles.shortcutButtonRecording : styles.shortcutButtonNormal}
      >
        {recording ? '키 조합을 누르세요... (Esc 취소)' : value || '(설정 안 됨)'}
      </button>
      {errMsg && <span className={styles.errorText}>{errMsg}</span>}
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
  const handleUpdate = (patch: Partial<typeof settings.shortcuts>) =>
    onChange({
      ...settings,
      shortcuts: { ...settings.shortcuts, ...patch },
    });

  const notice = useMemo(
    () =>
      '앱에 포커스가 있을 때만 동작합니다. 텍스트 입력 중에는 일부 단축키가 무시될 수 있습니다.',
    [],
  );

  return (
    <>
      <Section title="녹음 제어" description={notice}>
        <ShortcutCapture
          label="녹음 시작/정지"
          value={settings.shortcuts.toggleRecord}
          onChange={(v) => handleUpdate({ toggleRecord: v })}
          allShortcuts={settings.shortcuts}
          currentKey="toggleRecord"
        />
        <ShortcutCapture
          label="줄바꿈 삽입"
          value={settings.shortcuts.newline}
          onChange={(v) => handleUpdate({ newline: v })}
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
          onChange={(v) => handleUpdate({ copyCC: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyCC"
        />
        <ShortcutCapture
          label="S 복사"
          value={settings.shortcuts.copyS}
          onChange={(v) => handleUpdate({ copyS: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyS"
        />
        <ShortcutCapture
          label="O 복사"
          value={settings.shortcuts.copyO}
          onChange={(v) => handleUpdate({ copyO: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyO"
        />
        <ShortcutCapture
          label="A 복사"
          value={settings.shortcuts.copyA}
          onChange={(v) => handleUpdate({ copyA: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyA"
        />
        <ShortcutCapture
          label="P 복사"
          value={settings.shortcuts.copyP}
          onChange={(v) => handleUpdate({ copyP: v })}
          allShortcuts={settings.shortcuts}
          currentKey="copyP"
        />
      </Section>
    </>
  );
}
