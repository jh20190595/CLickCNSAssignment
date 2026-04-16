# Frontend 파일 가이드

Next.js(App Router) 프론트. `src/` 디렉터리는 사용하지 않고 루트에 `app/` · `components/` · `hooks/`를 둔다.

## `app/` — App Router 페이지

- **layout.tsx** — 루트 레이아웃. 전역 폰트/메타데이터 정의, `globals.css` import.
- **page.tsx** — 메인 페이지(`"use client"`). `useStt` 훅을 호출해 상태를 받아 `MicButton` + `TranscriptBox`에 연결.
- **globals.css** — Tailwind 지시문 및 전역 스타일.
- **favicon.ico** — 파비콘.

## `components/`

- **MicButton.tsx** — 녹음 토글 버튼. `idle` / `connecting` / `recording` / `processing` / `error` 상태별로 색·아이콘·ping 애니메이션 전환.
- **TranscriptBox.tsx** — 최종 인식 결과 목록을 렌더, 진행 중 `partial` 텍스트는 이탤릭으로 표시. 새 결과가 오면 자동 스크롤.

## `hooks/`

- **useStt.ts** — STT 핵심 훅. `socket.io-client`로 `/stt` 네임스페이스에 연결, `getUserMedia`로 마이크를 열고 `AudioContext` + `ScriptProcessorNode`로 Float32 → Int16 PCM 16kHz 변환 후 `audio_chunk`로 전송. 종료 시 `audio_end` emit. `transcript_partial` / `transcript_final` 수신. 백엔드 URL은 `NEXT_PUBLIC_BACKEND_URL`(기본 `http://localhost:3001`).
