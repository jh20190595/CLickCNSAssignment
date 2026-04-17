# frontend/app

Next.js App Router 루트. 페이지·레이아웃·전역 스타일.

## Files

### `layout.tsx` — RootLayout (Server Component)
- 모든 페이지를 감싸는 최상위 레이아웃
- Geist / Geist Mono 폰트를 `next/font/google`로 로드해 CSS 변수(`--font-geist-sans`, `--font-geist-mono`)로 주입
- `<html lang="ko">` + 밝은 테마(`bg-slate-50 text-slate-900`)
- `metadata` export: 탭 제목 `"SOAP 진료 기록"`, 설명 `"의사용 실시간 음성 진료 기록 도구"`

### `page.tsx` — Home (`/`)
- `"use client"`. 앱 메인 화면. 상단 헤더 + 본문 그리드 `grid-cols-[3fr_1fr]` (메인 영역 | `SessionHistoryPanel`)
- 세 가지 `mode` 상태 관리 (`idle` / `recording` / `review`) — 사이드바는 모든 모드에서 노출, 녹음 중엔 `disabled`
  - `idle` — `EmptyState` (과거 세션은 사이드바에서 열람)
  - `recording` — `RecordingIndicator` (녹음 상태 + 실시간 전사 인라인 표시)
  - `review` — `SoapEditor` (전사 → LLM 자동 SOAP 분류 → 편집/저장/내보내기)
- 사이드바에서 다른 환자의 세션 클릭 시 `setPatient`로 환자 자동 전환 후 `openSession` 호출
- 훅 조합: `useSettings` + `useStt({ settings })` + `useHotkeys`
  - `useStt`에서 `fullTranscript` 수신 시 `review` 모드 전환
  - `useHotkeys`로 `settings.shortcuts.toggleRecord`/`newline`을 녹음 토글/줄바꿈 삽입에 연결. `toggleRecord`는 editable 화이트리스트에 포함(편집 중에도 동작)
- 헤더 구성(`grid-cols-3`): 좌측 제목, 중앙 `RecordToggle`, 우측 `PatientSelector` + `SettingsButton`
  - `PatientSelector`는 녹음 중에만 disabled. 리뷰 중 환자 변경 시 confirm 다이얼로그 후 `exitReview` → 새 환자 선택
- `SettingsModal`은 최상위에서 렌더 (모든 mode에서 접근 가능)

### `globals.css`
- Tailwind 지시문 및 전역 스타일

### `favicon.ico`
- 브라우저 탭 아이콘

## Conventions
- 클라이언트 측 상태/이벤트가 필요한 페이지는 반드시 `"use client"` 선언
- 상위 `frontend/AGENTS.md` 지침대로 Next.js API 사용 전 `node_modules/next/dist/docs/` 가이드 확인
