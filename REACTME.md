# 음성 텍스트 변환 앱 — 개발 설명서

> 면접 질문 대비용. 코드가 왜 이렇게 동작하는지, 내가 어떤 결정을 왜 했는지 설명할 수 있도록 작성.

---

## 1. 전체 데이터 흐름 (한 줄 요약)

> "마이크 버튼을 누르면 브라우저가 마이크 소리를 잡고 → WebSocket으로 백엔드에 실시간 전송 → 백엔드의 Vosk AI가 텍스트로 변환 → 다시 WebSocket으로 프론트에 돌려줘서 화면에 표시"

```
[사용자 마이크]
     ↓ Web Audio API (Float32 PCM)
[useStt 훅] — Float32 → Int16 변환
     ↓ socket.io WebSocket (audio_chunk 이벤트)
[NestJS SttGateway] — 이벤트 수신
     ↓
[SttService] — Vosk Recognizer에 오디오 주입
     ↓
[Vosk 한국어 모델] — 음성 → 텍스트
     ↓ transcript_partial / transcript_final 이벤트
[useStt 훅] — 상태 업데이트
     ↓ React 리렌더링
[TranscriptBox 컴포넌트] — 화면에 텍스트 표시
```

---

## 2. 왜 WebSocket을 썼나? (HTTP 대신)

HTTP로 만들면 녹음이 끝난 뒤 파일 전체를 한 번에 전송 → 결과가 한참 뒤에 나옴.

WebSocket을 쓰면 말하는 도중에도 인식 결과가 실시간으로 올라옴. 사용자 입장에서 훨씬 자연스럽다.

Vosk 자체가 스트리밍 인식을 지원하기 때문에 WebSocket과 궁합이 딱 맞는다.

---

## 3. 프론트엔드 코드 설명

### `hooks/useStt.ts` — 핵심 로직이 다 여기 있다

React 개발자가 가장 집중해서 볼 파일. 세 가지 일을 한다:
1. WebSocket 연결 관리1
2. 마이크 오디오 캡처
3. 오디오 포맷 변환 후 전송

**WebSocket 연결 (`connect` 함수)**
```ts
const socket = io(`${BACKEND_URL}/stt`, { transports: ["websocket"] });
```
- socket.io의 `/stt` 네임스페이스에 연결. 네임스페이스는 React Router의 경로처럼 같은 서버 안에서 채널을 분리하는 개념.
- `transports: ["websocket"]` — 기본값은 polling → websocket으로 업그레이드하는데, 이 옵션으로 처음부터 WebSocket만 쓰도록 강제.

**서버 이벤트 구독**
```ts
socket.on("transcript_partial", ({ text }) => setPartialText(text));
socket.on("transcript_final", ({ text }) => setFinalTexts(prev => [...prev, text]));
```
- `transcript_partial`: 말하는 도중에 오는 중간 결과. 화면에 회색 이탤릭으로 표시됨.
- `transcript_final`: 버튼을 떼면 오는 최종 확정 결과. 배열에 누적.
- React Native의 `socket.on()`과 완전히 같은 패턴.

**마이크 오디오 캡처 (`startRecording`)**
```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext({ sampleRate: 16000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);
```
- `getUserMedia` — 마이크 권한 요청. React Native의 `Audio.requestPermissionsAsync()`와 같은 역할.
- `AudioContext` — Web Audio API의 오디오 처리 그래프 루트. sampleRate를 16000Hz로 고정하는 이유: Vosk 한국어 모델이 16kHz PCM만 받기 때문.
- `ScriptProcessorNode` — 오디오 스트림을 4096 샘플(약 256ms) 단위로 잘라서 콜백으로 넘겨줌.

**Float32 → Int16 변환**
```ts
processor.onaudioprocess = (e) => {
  const float32 = e.inputBuffer.getChannelData(0);
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  socketRef.current?.emit("audio_chunk", int16.buffer);
};
```
- 브라우저 Web Audio API는 오디오를 Float32(-1.0 ~ 1.0)로 제공.
- Vosk는 Int16(-32768 ~ 32767) PCM을 요구.
- 수식 `s * 0x7fff`(양수)와 `s * 0x8000`(음수)로 변환.
- 변환된 버퍼를 `audio_chunk` 이벤트로 바로 전송 → 말하는 내내 256ms마다 전송됨.

**왜 `useRef`를 썼나?**
```ts
const socketRef = useRef<Socket | null>(null);
const audioContextRef = useRef<AudioContext | null>(null);
```
- socket, audioContext, mediaStream은 리렌더링해도 값이 유지되어야 하고, 바뀌어도 리렌더링이 필요 없음.
- `useState`로 하면 값이 바뀔 때마다 리렌더링되고, 오디오 처리 콜백 내부에서 클로저 문제가 생김.
- `useRef`는 React Native에서도 같은 패턴으로 쓰임.

**상태(status) 5단계**
| 상태 | 의미 |
|------|------|
| `idle` | 대기 중 (서버 연결 완료) |
| `connecting` | 마이크 버튼 눌렀을 때 권한 요청 중 |
| `recording` | 실제 녹음 + 전송 중 |
| `processing` | 버튼을 뗀 후 최종 결과 대기 중 |
| `error` | 서버 연결 실패 또는 마이크 권한 거부 |

---

### `components/MicButton.tsx` — 상태에 따라 UI가 바뀌는 버튼

**핵심 아이디어: 하나의 버튼이 두 가지 역할**
```tsx
onClick={isRecording ? onStop : onStart}
```
- 녹음 중이 아닐 때 누르면 `onStart` 호출 → 파란 마이크 버튼
- 녹음 중에 누르면 `onStop` 호출 → 빨간 정지 버튼

**녹음 중 시각적 피드백 (ping 애니메이션)**
```tsx
{isRecording && (
  <span className="absolute w-full h-full rounded-full bg-red-400 opacity-30 animate-ping" />
)}
```
- Tailwind의 `animate-ping`으로 물결 퍼지는 효과.
- 사용자에게 "지금 녹음 중"이라는 것을 직관적으로 전달.

**로딩 상태 처리**
```tsx
disabled={isLoading}  // connecting 또는 processing 중엔 버튼 비활성화
```
- 연결 중이거나 결과 대기 중일 때 버튼 클릭 방지. 스피너 아이콘 표시.

---

### `components/TranscriptBox.tsx` — 결과 표시 영역

**두 가지 텍스트를 구분해서 표시**
```tsx
{finalTexts.map((text, i) => (
  <p key={i} className="text-gray-100">{text}</p>  // 확정 결과: 하얀색
))}
{partialText && (
  <p className="text-gray-400 italic">{partialText}...</p>  // 중간 결과: 회색 이탤릭
)}
```
- 확정된 결과는 배열로 누적 → 여러 번 말해도 다 남음.
- 말하는 중간 결과는 계속 교체(회색으로 구분).

**자동 스크롤**
```tsx
const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [finalTexts, partialText]);
```
- 텍스트가 늘어날 때마다 맨 아래로 부드럽게 스크롤.
- React Native의 `FlatList`의 `scrollToEnd`와 같은 목적.

---

### `app/page.tsx` — 조립 레이어

```tsx
const { status, partialText, finalTexts, error, startRecording, stopRecording, clearTexts } = useStt();
```
- `useStt` 훅이 모든 상태와 로직을 가지고 있음.
- `page.tsx`는 그걸 받아서 컴포넌트에 props로 내려주는 역할만 함.
- 로직과 UI를 분리한 구조: 훅에서 what을 관리, 컴포넌트에서 how를 관리.

---

## 4. 백엔드 코드 설명 (NestJS — React 관점으로)

NestJS를 React 관점으로 보면:
- `Module` = 기능 단위 묶음 (컴포넌트 파일 묶는 폴더 개념)
- `Gateway` = WebSocket 이벤트 핸들러 (프론트의 `socket.on` 반대편)
- `Service` = 비즈니스 로직 (커스텀 훅처럼 로직만 담당)
- `@Injectable()` = NestJS가 클래스를 자동으로 생성하고 주입해줌 (Context의 Provider 같은 것)

> **아키텍처 결정:** Vosk의 Node.js npm 패키지(`ffi-napi` 기반)는 최신 Node.js/Linux 환경에서 컴파일 호환성 문제가 있어, **Python subprocess 방식**을 선택했다. NestJS가 Python 프로세스(`stt_worker.py`)를 생성하고 stdin/stdout으로 통신한다. Python의 vosk 패키지는 pip으로 안정적으로 설치되고 모든 환경에서 동작한다.

---

### `stt/stt.gateway.ts` — 이벤트 수신창구

```ts
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/stt' })
export class SttGateway implements OnGatewayConnection, OnGatewayDisconnect {
```
- `namespace: '/stt'` — 프론트에서 `io('/stt')`로 연결하는 엔드포인트.
- `OnGatewayConnection`, `OnGatewayDisconnect` — 클라이언트가 연결/해제될 때 자동으로 호출될 인터페이스.

**연결 시 Worker 초기화**
```ts
handleConnection(client: Socket) {
  this.sttService.initRecognizer(client.id, (text) => {
    client.emit('transcript_partial', { text });
  });
}
```
- 클라이언트 접속 시 해당 클라이언트 전용 Python 프로세스를 spawn.
- partial 결과를 받을 콜백을 Service에 전달. Service가 Python stdout을 읽으면 이 콜백을 호출.
- 연결이 끊기면 `closeRecognizer`로 Python 프로세스 종료 + 메모리 해제.
- 왜 클라이언트마다 별도 프로세스? → 여러 명이 동시에 쓸 때 서로 간섭 없이 독립적으로 인식.

**오디오 청크 수신**
```ts
@SubscribeMessage('audio_chunk')
handleAudioChunk(@ConnectedSocket() client: Socket, @MessageBody() data: Buffer) {
  this.sttService.sendChunk(client.id, Buffer.from(data));
}
```
- 프론트가 `audio_chunk` 이벤트를 보낼 때마다 실행.
- `@SubscribeMessage` = 프론트의 `socket.on('audio_chunk', ...)` 반대편.
- 받은 버퍼를 Python 프로세스 stdin으로 전달. partial 결과는 콜백으로 비동기 수신.

**녹음 종료 처리**
```ts
@SubscribeMessage('audio_end')
handleAudioEnd(@ConnectedSocket() client: Socket) {
  const result = this.sttService.finalizeResult(client.id);
  client.emit('transcript_final', { text: result });
  this.sttService.resetRecognizer(client.id);
}
```
- 프론트에서 버튼을 떼면 `audio_end` 이벤트 전송.
- Vosk에 "이제 끝났다"고 알리면 남은 오디오까지 처리해 최종 결과 반환.
- Recognizer를 reset해서 다음 녹음을 준비.

---

### `stt/stt.service.ts` — Python Worker 프로세스 관리

**클라이언트별 Python 프로세스 Map**
```ts
private sessions = new Map<string, WorkerSession>();
```
- 키: `client.id` (socket.io 고유 ID)
- 값: Python 프로세스 + partial 콜백 + final Promise
- 클라이언트 1명 = Python 프로세스 1개. 독립된 음성 인식 세션 보장.

**Python 프로세스 생성 (`initRecognizer`)**
```ts
const worker = spawn('python3', [WORKER_SCRIPT], {
  env: { ...process.env, VOSK_MODEL_PATH: MODEL_PATH },
  stdio: ['pipe', 'pipe', 'pipe'],
});
```
- Node.js `child_process.spawn`으로 Python 스크립트를 별도 프로세스로 실행.
- stdin/stdout/stderr를 pipe로 연결해 부모(NestJS)와 통신.
- `readline`으로 Python stdout을 한 줄씩 읽어 JSON 파싱.

**NestJS ↔ Python 통신 프로토콜 (바이너리)**
```
stdin: [1바이트 타입][4바이트 길이][N바이트 데이터]
  0x01 = audio_chunk (오디오 전송)
  0x02 = audio_end (녹음 종료)
  0x03 = reset (다음 녹음 준비)

stdout: JSON 한 줄씩
  {"type":"partial","text":"안녕"}
  {"type":"final","text":"안녕하세요"}
```
- 바이너리 프로토콜 사용 이유: 텍스트 구분자 없이 임의 크기 오디오 버퍼를 정확히 전달하기 위함.

**최종 결과 비동기 처리**
```ts
finalizeResult(clientId: string): Promise<string> {
  return new Promise((resolve) => {
    session.finalPending = { resolve };  // 나중에 Python이 응답하면 resolve
    session.process.stdin.write(Buffer([0x02]));  // audio_end 전송
    setTimeout(() => { resolve(''); }, 5000);     // 5초 타임아웃
  });
}
```
- Python이 `{"type":"final"}` JSON을 보내면 readline 핸들러가 `resolve` 호출.
- 5초 내 응답 없으면 빈 문자열로 resolve (타임아웃 보호).
- React의 `fetch` + `async/await` 패턴과 동일한 Promise 개념.

**Python 워커 (`stt_worker.py`) 핵심 로직**
```python
if rec.AcceptWaveform(data):           # 문장 경계 감지
    result = json.loads(rec.Result())
    emit({"type": "partial", "text": result["text"]})
else:
    partial = json.loads(rec.PartialResult())
    emit({"type": "partial", "text": partial["partial"]})
```
- NestJS가 보낸 바이너리를 stdin에서 읽어 Vosk에 주입.
- 결과를 JSON으로 stdout에 출력 → NestJS readline이 수신.

---

## 5. Electron 설명

### `desktop/src/main.js` — 웹앱을 데스크탑 창으로 감싸는 껍데기

Electron은 Chromium(크롬 엔진) + Node.js를 합쳐서 웹앱을 데스크탑 앱처럼 실행하게 해주는 프레임워크.

```js
const win = new BrowserWindow({
  width: 900,
  height: 680,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,   // 보안: 렌더러와 Node.js 환경 분리
    nodeIntegration: false,   // 보안: 렌더러에서 Node.js 직접 접근 금지
  },
});
win.loadURL('http://localhost:3000');  // Next.js 앱 로드
```

- React Native가 네이티브 뷰를 감싸듯, Electron은 웹 뷰를 데스크탑 창으로 감쌈.
- `contextIsolation: true` + `nodeIntegration: false` — 보안 베스트 프랙티스. 웹 코드가 파일 시스템 등 Node.js에 직접 접근하지 못하게 막음.
- `preload.js` — 안전하게 허용된 API만 `window.electronAPI`로 노출하는 브릿지.

**exe 빌드**
```json
"build": {
  "win": { "target": "nsis" }  // NSIS 인스톨러로 exe 생성
}
```
- `npm run build:win` 실행 → `desktop/dist/` 안에 설치 exe 파일 생성.

---

## 6. Docker 설명

### `docker-compose.yml` — 로컬에서 전체 스택 한 번에 올리기

```yaml
services:
  backend:
    build: { context: ./backend }
    ports: ["3001:3001"]
    volumes:
      - ./backend/model:/app/model:ro   # Vosk 모델 파일을 컨테이너에 마운트 (읽기전용)
  
  frontend:
    build: { context: ./frontend }
    ports: ["3000:3000"]
    depends_on: [backend]       # 백엔드가 먼저 뜨고 나서 프론트 실행
```

**왜 Docker가 필요한가?**
- Vosk Python 패키지는 Linux에서 pip으로 바로 설치 가능. Docker로 환경을 통일하면 Windows/Mac에서도 동일하게 동작.
- 프론트/백엔드를 각각 컨테이너로 격리해 서로 영향 없이 독립적으로 배포 가능.
- 백엔드 이미지에 Python + vosk pip을 포함시키고, NestJS가 `python3 stt_worker.py`를 subprocess로 실행.

---

## 7. Kubernetes 설명

### `k8s/backend-deployment.yaml` — 프로덕션 배포 설정

Docker Compose가 로컬 개발용이라면, Kubernetes(K8s)는 클라우드/서버 프로덕션 배포용.

```yaml
spec:
  replicas: 1          # 컨테이너 1개 실행
  resources:
    requests:
      memory: "512Mi"  # 최소 보장
    limits:
      memory: "2Gi"    # 최대 허용 (Vosk 모델이 메모리를 많이 씀)
```

**Deployment vs Service**
- `Deployment` — "이 컨테이너 이미지를 N개 실행해줘"라고 K8s에 선언하는 것.
- `Service` — 컨테이너들에 접근할 수 있는 고정 주소 제공. 컨테이너가 재시작되어도 주소 유지.

```yaml
# backend Service: ClusterIP (내부용 — 프론트엔드만 접근)
type: ClusterIP

# frontend Service: NodePort (외부용 — 브라우저/Electron이 접근)
type: NodePort
```

**Vosk 모델 마운트**
```yaml
volumes:
  - name: vosk-model
    hostPath:
      path: /data/vosk-model-ko  # 서버 실제 경로
```
- 모델 파일(1.2GB)을 컨테이너 이미지에 포함시키면 이미지가 너무 커짐.
- 서버의 특정 경로에 모델을 두고 컨테이너에 마운트해서 공유.

---

## 8. 면접에서 나올 수 있는 질문 & 답변

**Q. WebSocket을 왜 HTTP 대신 썼나요?**
> HTTP는 요청-응답 구조라 녹음이 끝나야 전송 가능. WebSocket은 양방향 실시간 통신이라 말하는 도중에도 오디오를 서버로 계속 보내고, 서버도 인식 결과를 즉시 돌려줄 수 있음. UX가 훨씬 자연스러워짐.

**Q. 왜 Float32를 Int16으로 변환하나요?**
> 웹 브라우저의 Web Audio API는 오디오 샘플을 Float32(-1.0~1.0)로 제공. Vosk는 표준 PCM 포맷인 Int16(-32768~32767)을 요구. 두 포맷 사이를 수학적으로 변환해야 Vosk가 인식할 수 있음.

**Q. 클라이언트마다 Recognizer를 별도로 만드는 이유가 뭔가요?**
> Vosk Recognizer는 내부적으로 이전 오디오 문맥을 기억하며 인식. 여러 사용자가 동시에 접속할 때 한 Recognizer를 공유하면 A의 말과 B의 말이 섞임. Map으로 client.id별 독립된 인식기를 관리해 멀티유저를 지원.

**Q. Electron에서 왜 contextIsolation을 켰나요?**
> 웹 렌더러(Next.js)와 Node.js 환경을 분리하는 보안 설정. 이를 끄면 악의적인 웹 코드가 파일 시스템 삭제 같은 Node.js API를 직접 호출할 수 있음. preload.js를 통해 필요한 것만 명시적으로 노출.

**Q. Next.js에서 output: standalone이 뭔가요?**
> `next build` 시 node_modules 전체를 포함하지 않고 실행에 필요한 파일만 최소한으로 묶는 옵션. Docker 이미지 크기가 크게 줄어들고, `node server.js` 하나로 서버를 실행할 수 있어 컨테이너 배포에 최적.

**Q. useRef와 useState 중 왜 useRef를 썼나요?**
> socket, AudioContext, MediaStream은 리렌더링 간에 값이 유지되어야 하지만, 이 값들이 바뀌어도 UI는 다시 그릴 필요가 없음. useState로 하면 값이 바뀔 때마다 불필요한 리렌더링 발생. useRef는 값을 보관하되 리렌더링을 유발하지 않아 적합.

**Q. ScriptProcessorNode 대신 AudioWorklet을 안 쓴 이유는?**
> AudioWorklet이 더 최신이고 메인 스레드를 블로킹하지 않는 방식이라 성능상 권장됨. 하지만 구현이 복잡하고 별도 Worker 파일 관리가 필요. 이 프로젝트 규모에서는 ScriptProcessorNode로 충분하고 빠르게 구현 가능. (개선 포인트로 언급 가능)

**Q. 왜 Vosk를 Node.js 패키지 대신 Python subprocess로 연결했나요?**
> Vosk의 Node.js 패키지(`vosk` npm)는 내부적으로 `ffi-napi`를 사용하는데, 이 패키지가 최신 Node.js 버전과 Linux 빌드 환경에서 C++ 컴파일 호환성 문제를 일으켰음. 반면 Python의 vosk 패키지(`pip install vosk`)는 prebuilt wheel로 배포되어 모든 환경에서 안정적으로 설치됨. NestJS의 `child_process.spawn`으로 Python 프로세스를 생성하고 stdin/stdout 바이너리 프로토콜로 통신하는 방식을 선택했음. 실제 프로덕션에서도 Python 기반 ML 모델을 Node.js 서비스에서 subprocess로 연결하는 패턴은 흔하게 사용됨.

---

## 9. 프로젝트 구조 한눈에

```
signment/
├── backend/
│   ├── model/               — Vosk 한국어 모델 (vosk-model-small-ko-0.22, 83MB)
│   └── src/stt/
│       ├── stt.module.ts    — Gateway + Service를 하나의 기능 단위로 묶음
│       ├── stt.gateway.ts   — WebSocket 이벤트 진입점 (audio_chunk, audio_end 수신)
│       ├── stt.service.ts   — Python subprocess 관리, 클라이언트별 세션 Map
│       └── stt_worker.py    — Python Vosk 워커 (stdin→Vosk→stdout JSON)
│
├── frontend/
│   ├── hooks/useStt.ts          — 모든 로직 (WebSocket + 오디오 캡처 + 상태)
│   ├── components/
│   │   ├── MicButton.tsx        — 상태 기반 버튼 UI
│   │   └── TranscriptBox.tsx    — 결과 텍스트 표시
│   └── app/page.tsx             — 조립만 담당
│
├── desktop/
│   └── src/main.js  — Electron 창 생성, Next.js URL 로드, exe 빌드 설정
│
├── k8s/
│   ├── backend-deployment.yaml  — 백엔드 Pod + ClusterIP Service
│   └── frontend-deployment.yaml — 프론트엔드 Pod + NodePort Service
│
└── docker-compose.yml  — 로컬 개발용 전체 스택
```
