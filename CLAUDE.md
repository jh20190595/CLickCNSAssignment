# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

실시간 한국어 음성 텍스트 변환(STT) 데스크탑 앱.
마이크 버튼을 누르고 말하면 WebSocket으로 오디오를 백엔드에 스트리밍하고, Vosk 한국어 모델이 텍스트로 변환해 화면에 표시한다.

**스택:** NestJS (backend) · Next.js (frontend) · Electron (desktop shell) · Vosk (STT) · Docker + Kubernetes

## Commands

### Backend (NestJS — port 3001)
```bash
cd backend
npm run start:dev     # 개발 서버 (watch 모드)
npm run build         # dist/ 빌드
npm run start:prod    # 프로덕션 실행
npm run test          # 단위 테스트
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
npm install           # electron, electron-builder 설치
npm run dev           # Electron 실행 (Next.js dev 서버 필요)
npm run build:win     # Windows exe 빌드 → dist/
npm run build:mac     # macOS dmg 빌드
```

### Docker
```bash
# 루트에서 실행
docker-compose up --build     # backend + frontend 동시 기동
docker-compose up backend     # 백엔드만
```

### Kubernetes
```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

## Architecture

### Data Flow
```
Electron → Next.js 페이지 (http://localhost:3000)
  → useStt hook
    → socket.io WebSocket (/stt 네임스페이스)
      → NestJS SttGateway
        → SttService (Vosk 한국어 모델)
          → transcript_partial / transcript_final 이벤트 → UI 표시
```

### WebSocket 이벤트 (socket.io, namespace: `/stt`)
| 방향 | 이벤트 | 데이터 | 설명 |
|------|--------|--------|------|
| Client → Server | `audio_chunk` | `ArrayBuffer` (Int16 PCM) | 녹음 중 청크 전송 |
| Client → Server | `audio_end` | — | 녹음 종료 신호 |
| Server → Client | `transcript_partial` | `{ text: string }` | 중간 인식 결과 |
| Server → Client | `transcript_final` | `{ text: string }` | 최종 확정 결과 |

### Backend (`backend/src/`)
- `main.ts` — CORS 전체 허용, port 3001
- `app.module.ts` — SttModule만 import
- `stt/stt.gateway.ts` — WebSocket 게이트웨이. 클라이언트 연결 시 `initRecognizer`, 해제 시 `closeRecognizer` 호출
- `stt/stt.service.ts` — Vosk 모델 로드(`onModuleInit`), 클라이언트별 Recognizer Map 관리. 오디오 샘플레이트: 16000Hz, PCM Int16
- `stt/stt.module.ts` — Gateway + Service 등록

**Vosk 모델 경로:** `backend/model/` (Docker에서는 `/app/model`로 마운트). 모델이 없으면 STT 비활성화(경고만 출력, 앱은 실행됨). 현재 `vosk-model-small-ko-0.22` (83MB) 사용 중.

### Frontend (`frontend/`)
- `hooks/useStt.ts` — socket.io 연결, `MediaRecorder` + `ScriptProcessorNode`로 Float32 오디오를 Int16 PCM으로 변환 후 청크 전송. BACKEND_URL은 `NEXT_PUBLIC_BACKEND_URL` 환경변수(기본값: `http://localhost:3001`)
- `components/MicButton.tsx` — 상태(idle/recording/connecting/processing/error)에 따른 버튼 UI + 녹음 중 ping 애니메이션
- `components/TranscriptBox.tsx` — 최종 결과 목록 + partial 텍스트(이탤릭) 표시, 자동 스크롤
- `app/page.tsx` — `"use client"`, useStt 훅 통합

**Next.js 빌드:** `output: "standalone"` 설정. Docker 이미지는 `.next/standalone/server.js`로 실행.

### Desktop (`desktop/`)
- `src/main.js` — `http://localhost:3000`을 BrowserWindow에 로드. `--dev` 플래그로 DevTools 열림
- `src/preload.js` — contextBridge로 `window.electronAPI.platform` 노출
- `electron-builder` 설정은 `package.json`의 `build` 필드에 정의

### Infrastructure
- `docker-compose.yml` — backend(3001) + frontend(3000). `./model`을 backend 컨테이너에 read-only 마운트
- `k8s/backend-deployment.yaml` — Vosk 모델은 hostPath `/data/vosk-model-ko`로 마운트
- `k8s/frontend-deployment.yaml` — NodePort 서비스

## Key Constraints

- **vosk npm 패키지**는 네이티브 바인딩(ffi-napi)으로 OneDrive 경로에서 로컬 `npm install` 불가. Docker 빌드 내에서만 설치됨
- **Vosk 한국어 모델** (`vosk-model-ko-0.22`, ~1.2GB)은 `backend/model/`에 수동 배치 필요. `.gitignore`에 포함됨
- 오디오 샘플레이트는 반드시 **16000Hz** (Vosk 요구사항)
- Electron은 Next.js를 독립 실행하지 않고 **외부 URL 로드** 방식 사용 (프로덕션에서도 Next.js 서버 필요)
