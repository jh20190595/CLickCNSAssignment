# 구현 중 겪었던 주요 이슈 및 해결 과정

## 1. Electron .exe 패키징 시 Python 의존성 번들링

### 문제
Vosk STT 엔진은 Python 기반이라, Electron으로 .exe를 빌드할 때 Python 런타임과 vosk 패키지를 함께 번들링해야 했다.
처음에는 vosk wheel 파일만 수동으로 다운로드하여 포함시켰는데, 실행할 때마다 빠진 의존성이 하나씩 터졌다.

- 1차: `No module named 'srt'` — vosk의 의존성인 srt 패키지 누락
- 2차: `failed _cffi_backend` — cffi의 Windows용 C 컴파일 바이너리(.pyd) 누락

vosk의 의존성 트리가 깊었고, 특히 cffi처럼 플랫폼별 네이티브 바이너리가 필요한 패키지는 단순히 .whl 파일만 넣어서는 해결되지 않았다.

```
vosk → cffi → _cffi_backend.pyd (C 컴파일 바이너리)
     → srt (순수 Python, wheel 미제공 — tar.gz만 존재)
     → requests → certifi, idna, urllib3, charset_normalizer
     → tqdm, pycparser
```

### 해결
수동 URL 관리 방식을 버리고, `pip download`에 `--platform win_amd64` 옵션을 사용하여 Mac 빌드 환경에서 Windows용 패키지 전체를 한 번에 다운로드하도록 변경했다.

```bash
pip3 download vosk --platform win_amd64 --python-version 311 --only-binary=:all:
```

이 명령 하나로 vosk + 모든 하위 의존성의 Windows 바이너리가 자동으로 해결되어, 이후 의존성이 추가되더라도 동일한 문제가 발생하지 않는다.

---

## 2. Windows 환경에서 한글 인코딩 깨짐

### 문제
.exe를 Windows에서 실행하면 STT 음성 인식 자체는 동작하지만, 인식된 한국어 텍스트가 `◆?◆`, `̾ ʴϱ` 등으로 깨져서 표시되었다.

### 원인
Python stt_worker.py가 JSON으로 인식 결과를 stdout에 출력하고, Node.js(NestJS)가 이를 readline으로 읽는 구조인데:
- Windows Python의 기본 stdout 인코딩은 **CP949** (한국어 Windows 코드 페이지)
- Node.js는 **UTF-8**로 읽음
- 인코딩 불일치로 한글이 깨짐

### 해결
Python worker를 spawn할 때 환경변수로 UTF-8 인코딩을 강제했다.

```typescript
const worker = spawn(PYTHON_CMD, [WORKER_SCRIPT], {
  env: {
    ...process.env,
    VOSK_MODEL_PATH: MODEL_PATH,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  },
});
```

---

## 3. 크로스 플랫폼 빌드 환경 (Mac에서 Windows .exe 빌드)

### 문제
개발 환경은 macOS인데 배포 대상은 Windows였다. Electron의 electron-builder는 크로스 플랫폼 빌드를 지원하지만, Python 임베디드 환경과 네이티브 바이너리는 별도로 관리해야 했다.

### 해결
`desktop/scripts/prepare-resources.js` 빌드 스크립트를 작성하여 다음을 자동화했다:

1. Backend(NestJS) 빌드 → `dist/` 생성
2. Frontend(Next.js) standalone 빌드
3. Windows용 Python 임베디드 배포판 다운로드 및 추출
4. pip download로 Windows용 vosk + 전체 의존성 다운로드
5. Vosk 한국어 모델 복사
6. VC++ Redistributable 번들링

이를 통해 `npm run build:win` 한 줄로 Mac에서 Windows .exe를 빌드할 수 있게 했다.

---

## 4. Vosk 모델 관리

### 문제
Vosk 한국어 모델(`vosk-model-small-ko-0.22`)은 83MB로, Git에 포함시키기에는 크다. 하지만 STT 기능의 핵심이라 반드시 필요하다.

### 해결
- `backend/model/`에 수동 배치하고 `.gitignore`에 포함
- Docker 빌드 시에는 `volumes`로 호스트의 모델 디렉토리를 마운트
- Electron .exe 빌드 시에는 `prepare-resources.js`가 `extraResources`로 자동 복사
- Kubernetes 배포 시에는 `hostPath`로 노드의 모델 디렉토리 참조

---

## 5. 실시간 STT 파이프라인 설계 (NestJS ↔ Python 프로세스 통신)

### 문제
Vosk는 Python 라이브러리인데 백엔드는 NestJS(Node.js)다. npm의 vosk 패키지는 네이티브 빌드 의존성이 많아 Electron 패키징과 호환이 어렵다.

### 해결
NestJS가 `stt_worker.py`를 자식 프로세스로 spawn하고, 바이너리 프로토콜로 stdin/stdout 통신하는 구조를 설계했다.

- **stdin (Node → Python):** 1바이트 메시지 타입 + 4바이트 길이(Big-Endian) + PCM 데이터
  - `0x01`: audio_chunk, `0x02`: audio_end, `0x03`: reset
- **stdout (Python → Node):** JSON Lines 형식
  - `{"type":"partial","text":"..."}` — 인식 중간 결과
  - `{"type":"segment","text":"..."}` — 문장 확정
  - `{"type":"final","text":"..."}` — 세션 종료 후 잔여 텍스트

이 구조 덕분에 Python과 Node.js 간 의존성이 분리되어 각각 독립적으로 빌드/배포할 수 있다.
