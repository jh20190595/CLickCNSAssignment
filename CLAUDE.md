# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

실시간 한국어 음성 → SOAP 진료 기록 데스크탑 앱.
환자를 선택하고 녹음하면 Vosk가 텍스트로 전사하고, 후처리 파이프라인으로 약어·단위·날짜·번호 호출을 정규화한 뒤, LLM이 SOAP 4섹션(Subjective/Objective/Assessment/Plan)으로 자동 분류한다. 사용자는 편집·저장·내보내기(MD/TXT)까지 한 화면에서 수행한다.

**스택:** NestJS (backend) · Next.js 15 App Router (frontend) · Electron (desktop shell) · Vosk (STT) · Anthropic/OpenAI (SOAP 분류) · Docker + Kubernetes

## Commands

### Backend (NestJS — port 3001)
```bash
cd backend
npm run start:dev     # 개발 서버 (watch 모드)
npm run build         # dist/ 빌드
npm run start:prod    # 프로덕션 실행
npm run test          # 단위 테스트 (postprocess/*.spec.ts)
npm run test:e2e      # E2E 테스트
npm run lint          # ESLint
```

### Frontend (Next.js — port 3000)
```bash
cd frontend
npm run dev           # 개발 서버
npm run build         # standalone 빌드 (.next/standalone/)
npm run start         # 프로덕션 실행
npm run lint          # ESLint
```

### Desktop (Electron)
```bash
cd desktop
npm install
npm run dev           # Electron 실행 (Next.js dev 서버 필요)
npm run build:win     # Windows exe 빌드 → dist/
npm run build:mac     # macOS dmg 빌드
```

### Docker
```bash
# 루트에서
docker-compose up --build     # backend + frontend 동시 기동
docker-compose up backend     # 백엔드만 (프론트는 로컬 dev 서버와 조합 가능)
```

### Kubernetes
```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

## Architecture

### 전체 데이터 흐름

```
Electron ─▶ Next.js (http://localhost:3000)
  └─ useStt ─ socket.io /stt ─▶ SttGateway ─▶ SttService (Python worker: Vosk)
                                                    │
                                                    └─ transcript_partial / transcript_final 이벤트
  (녹음 종료)
  └─ audio_end ─▶ gateway ─ runPostprocess(raw, options) ─▶ transcript_complete { raw, text }
  (SOAP 분류)
  └─ fetch POST /llm/soap { transcript, meta } ─▶ LlmService (Anthropic/OpenAI) ─▶ {S,O,A,P}
```

### WebSocket 이벤트 (socket.io, namespace: `/stt`)

| 방향 | 이벤트 | 데이터 | 설명 |
|------|--------|--------|------|
| Client → Server | `audio_chunk` | `ArrayBuffer` (Int16 PCM) | 녹음 중 청크 전송 |
| Client → Server | `audio_end` | — | 녹음 종료 신호 |
| Client → Server | `settings_update` | `{ numberCall, dateFormat }` | 후처리 옵션 갱신 |
| Server → Client | `transcript_partial` | `{ text: string }` | 중간 인식 결과 |
| Server → Client | `transcript_final` | `{ text: string }` | 문장 확정 (세그먼트) |
| Server → Client | `transcript_complete` | `{ raw: string, text: string }` | 세션 종료 후 후처리 완료 |

### Backend (`backend/src/`)

- `main.ts` — CORS 전체 허용, port 3001
- `app.module.ts` — `SttModule` + `LlmModule`
- `stt/` — STT 도메인 (Vosk Python worker 구동). 자세한 내용은 `backend/src/CLAUDE.md`
- `postprocess/` — 전사 결과 정규화 파이프라인 (약어 → 단위 → 날짜 → 번호 호출 → 공백 정리)
- `llm/` — `POST /llm/soap` 엔드포인트. `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` 중 있는 쪽 사용, 없으면 transcript를 S 섹션에 복사

**Vosk 모델 경로:** `backend/model/` (Docker에서는 `/app/model`). 모델이 없으면 STT 비활성화. 현재 `vosk-model-small-ko-0.22` (83MB) 사용 중.

### Frontend (`frontend/`)

- `app/` — Next.js App Router 페이지 (`page.tsx`가 메인 화면)
- `components/` — 프레젠테이션 컴포넌트 (환자 선택, 녹음 토글, SOAP 편집기, 설정 모달 등)
- `hooks/` — `useStt`(WebSocket+오디오 파이프라인), `useSettings`(localStorage 싱크), `useHotkeys`(전역 단축키)
- `lib/` — `types.ts`(도메인 타입), `patientStore`/`sessionStore`(localStorage 기반 CRUD), `settings.ts`(앱 설정 저장), `voiceCommands.ts`(명령어 감지), `soapClient.ts`(LLM API 호출), `exportFormat.ts`(MD/TXT 출력)

**Next.js 빌드:** `output: "standalone"` 설정. Docker 이미지는 `.next/standalone/server.js`로 실행.

### Desktop (`desktop/`)

- `src/main.js` — `http://localhost:3000`을 BrowserWindow에 로드. `--dev` 플래그로 DevTools 열림
- `src/preload.js` — contextBridge로 `window.electronAPI.platform` 노출
- `electron-builder` 설정은 `package.json`의 `build` 필드

### Infrastructure

- `docker-compose.yml` — backend(3001) + frontend(3000). `./model`을 backend에 read-only 마운트
- `k8s/backend-deployment.yaml` — Vosk 모델은 hostPath `/data/vosk-model-ko`
- `k8s/frontend-deployment.yaml` — NodePort 서비스

## 도메인 데이터 모델

- **Patient** — 이름 + 환자코드. `localStorage(soap.patients.v1)`
- **Session** — 환자별 진료 한 건. `meta(visitType, chiefComplaint)` + `rawTranscript` + `soap`. `localStorage(soap.sessions.v2)`
- **Soap** — `{ subjective, objective, assessment, plan }`
- **AppSettings** — `localStorage(soap.settings.v1)`. `postprocess(numberCall, dateFormat)` + `audio(deviceId, gain)` + `voiceCommands(enabled, stopWord, newlineWord)` + `shortcuts(toggleRecord, newline)`

## Key Constraints

- **vosk npm 패키지**는 순수 Python으로 분리됨. 현재 구조는 NestJS가 `stt_worker.py` 자식 프로세스를 spawn하고 바이너리 프로토콜로 stdin/stdout 통신
- **Vosk 한국어 모델**은 `backend/model/`에 수동 배치 필요. `.gitignore`에 포함됨
- 오디오 샘플레이트는 반드시 **16000Hz** (Vosk 요구사항), Int16 PCM
- Electron은 Next.js를 외부 URL 로드 방식으로 쓰므로 프로덕션에서도 Next.js 서버 필요
- LLM 키가 없으면 SOAP 자동 분류는 "전체 전사를 S 섹션에 복사" 폴백으로 동작
