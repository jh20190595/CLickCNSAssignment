# frontend/hooks

WebSocket·오디오·앱 설정·단축키를 캡슐화한 커스텀 훅 3개.

## `useStt.ts` — STT 세션 + 오디오 파이프라인

백엔드(`/stt` socket.io 네임스페이스)와의 실시간 세션을 관리하고 Web Audio로 마이크 캡처·게인 조정을 수행.

### Exports
- `SttStatus = "idle" | "connecting" | "recording" | "processing" | "error"`
- `UseSttOptions = { settings?: AppSettings }`
- `useStt(options)` → `{ status, error, fullTranscript, finalTexts, partialText, isPaused, startRecording, stopRecording, resetTranscript, insertNewline }`

### 상수
- `BACKEND_URL` — `process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001"`
- `SAMPLE_RATE = 16000` (Vosk 요구), `CHUNK_SIZE = 4096`
- `TYPING_RESUME_MS = 1200` — 타이핑 감지 후 오디오 전송 재개 지연
- `NEWLINE_MARKER = "\n"` — finalTexts 배열 내 줄바꿈 표현

### 동작
- `connect` — websocket transport만 사용. 연결되면 `emitSettings()`(현재 `settings.postprocess`를 서버로 푸시)
- `startRecording`
  - `getUserMedia({ audio: { deviceId, sampleRate, channelCount: 1, echoCancellation, noiseSuppression, autoGainControl } })`. 사용자가 게인을 수동 조정 중이면 `autoGainControl: false`
  - `createGain()`을 source ↔ processor 사이에 삽입해 실시간 게인 반영
  - Float32 → Int16 PCM 변환 후 DC 오프셋 제거해서 `audio_chunk`로 전송
- `stopRecording` — 노드·스트림 정리 + `audio_end` emit. 1.5s 안에 `transcript_complete`가 안 오면 finalsRef join을 `fullTranscript`로 fallback
- `transcript_final` 수신 → `detectCommand(text, settings.voiceCommands)`로 명령어 매칭
  - `"stop"` → 내부 `stopRecordingRef.current?.()` 호출 (명령어 단어는 transcript에서 제거)
  - `"newline"` → `finalsRef`에 `\n` 삽입
- `transcript_complete` 수신 → `stripCommandWords`를 한 번 더 적용한 안전망, `fullTranscript` 세팅 후 `idle`
- 설정 런타임 반영 `useEffect`
  - `settings.postprocess` 변경 시 연결돼 있으면 `settings_update` emit
  - `settings.audio.gain` 변경 시 `gainNode.gain.setValueAtTime`
- 타이핑 감지 — 녹음 중 `document` keydown 발생 시 즉시 `pauseStream`, `TYPING_RESUME_MS` 뒤 자동 재개 (오디오 청크 전송만 멈춤. STT 세션은 유지)

## `useSettings.ts` — 앱 설정 싱크

```ts
const [settings, setSettings] = useSettings();
```

- `useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS)` 패턴
- `getSettings()`는 `frontend/lib/settings.ts`의 모듈 레벨 캐시 덕분에 localStorage 문자열이 바뀌지 않는 한 같은 참조를 반환(무한 루프 방지)
- `setSettings(next)` → `saveSettings(next)` → `CustomEvent('soap.settings.change')` + `storage` 이벤트로 다른 탭까지 전파

## `useHotkeys.ts` — 전역 단축키

```ts
useHotkeys({ "Ctrl+Shift+R": toggleRecord, "Ctrl+Enter": insertNewline }, { allowInEditable: ["Ctrl+Shift+R"] });
```

- `window.keydown` 리스너 한 번만 등록. bindings는 ref로 갱신돼 재구독 없이 최신 핸들러 호출
- `INPUT` / `TEXTAREA` / `contenteditable` 포커스 시 기본 무시. `allowInEditable`에 포함된 조합만 통과
- 파서 유틸
  - `parseCombo("Ctrl+Shift+R")` → `{ ctrl, alt, shift, meta, key }`
  - `serializeEvent(e)` → `"Ctrl+Shift+R"`. 수식키(Ctrl/Alt/Shift/Meta) 없는 단일 키는 `null` 반환해서 타이핑 충돌 방지 (SettingsModal의 캡처 UI에서도 활용)

## Conventions
- 훅은 로컬 상태를 최소화하고, 외부 저장소 싱크가 필요한 경우 `useSyncExternalStore`를 사용
- WebSocket/AudioContext 같은 리소스는 `useRef`로 보관하고 unmount에서 반드시 정리
- `ScriptProcessorNode`는 deprecated이지만 호환성 때문에 유지. AudioWorklet 이관 시 `useStt.ts`만 수정하면 됨
