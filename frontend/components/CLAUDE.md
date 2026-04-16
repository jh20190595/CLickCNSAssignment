# frontend/components

SOAP 기록 UI 프레젠테이션 컴포넌트. 모두 `"use client"`이며 상태/콜백은 상위(`app/page.tsx`)에서 props로 주입받는다.

## 헤더

### `PatientSelector.tsx`
- Props: `selectedPatient: Patient | null`, `onSelect`, `disabled?`
- 헤더 우측 드롭다운. 환자 검색(`searchPatients`) + 새 환자 추가(`NewPatientModal`) + 환자 삭제(세션까지 cascade: `deleteSessionsByPatient`)
- 녹음/리뷰 중에는 `disabled` 전달돼 선택 변경 불가

### `RecordToggle.tsx`
- Props: `status: SttStatus`, `elapsed`, `disabled?`, `disabledReason?`, `onStart`, `onStop`
- 헤더 중앙의 단일 토글 버튼. 녹음 중엔 `mm:ss · 정지`, 준비/처리 중엔 스피너, 그 외엔 `녹음`
- 환자 미선택 / `review` 모드일 때 `disabled`

### `SettingsButton.tsx`
- Props: `onClick`, `disabled?`
- 기어 아이콘 버튼. 클릭 시 `SettingsModal`을 연다.

## 본문

### `PatientSessionsPanel.tsx` (idle + 환자 선택 상태)
- Props: `patient`, `onOpen(session)`, `refreshKey?`
- `listSessionsByPatient(patient.id)` 결과를 리스트로. 클릭 시 `onOpen`, 삭제 버튼 포함
- `refreshKey` 변경 시 재조회 (저장/완료 후 상위에서 증가)

### `RecordingIndicator.tsx` (recording 모드)
- Props: `isPaused`, `status`, `error`
- `status`에 따라 분기 렌더: 준비 중 / 녹음 중(빨강·일시정지시 주황) / 처리 중 / 오류(+ reload 버튼)

### `SoapEditor.tsx` (review 모드)
- Props: `patient`, `meta`/`onMetaChange`, `rawTranscript`, `soap`/`onSoapChange`, `sessionId`/`onSessionSaved`, `onDone`
- 마운트 후 `rawTranscript`가 있고 SOAP이 비어 있으면 `classifySoap()` 자동 호출 (한 번만)
- 상단: 환자 라벨 + `VisitTypeToggle`(초진/재진) + 주증상 input
- 본문: 2×2 그리드로 `SoapPanel` 4개 (S/O/A/P) + 원본 전사 토글
- 하단: 원본 전사 보기 토글 + `ExportMenu` + 저장 / 완료. 저장은 `sessionId` 유무로 `saveSession` vs `updateSession` 분기

### `SoapPanel.tsx`
- Props: `label`, `hint`, `value`, `onChange`, `onRegenerate?`
- 한 섹션(S/O/A/P)의 제목 + 힌트 + `textarea`. `onRegenerate` 있으면 우상단 "재생성" 버튼

### `ConversationPanel.tsx` (우측 고정 사이드바)
- Props: `mode`, `finalTexts`, `partialText`, `reviewTranscript?`, `isPaused`
- `recording` → 확정 세그먼트 + 회색 이탤릭 partial. 헤더에 빨강/주황 점으로 상태 표시
- `review` → `reviewTranscript`를 whitespace-preserving으로 단일 문단 표시
- `idle` → 플레이스홀더

## 내보내기 / 설정

### `ExportMenu.tsx`
- Props: `patient`, `meta`, `soap`, `rawTranscript`
- `buildMarkdown` / `buildPlainText` / `downloadTextFile` 조합. "전체 복사 (MD)", "MD 파일", "TXT 파일" 3가지 제공

### `SettingsModal.tsx`
- Props: `open`, `settings`, `onChange`, `onClose`
- 좌측 탭 4개 (후처리 / 오디오 / 음성 명령어 / 단축키)
  - **후처리** — 번호 호출 토글 + 구분기호 + autoNewline + smallNumber / 날짜 포맷 라디오(`korean|iso|dot|english`)
  - **오디오** — 입력 장치 드롭다운(`enumerateDevices`, label이 비면 권한 요청 버튼) / 게인 슬라이더 0.5~3.0
  - **음성 명령어** — 활성화 토글 + `stopWord`(기본 "녹음 종료") / `newlineWord`(기본 "다음 줄")
  - **단축키** — `ShortcutCapture` 버튼 2개. 클릭 후 키 누르면 `serializeEvent`로 조합 저장. 수식키 없는 단일 키는 거부
- 저장 버튼 없이 onChange 즉시 `saveSettings` (상위 `useSettings`가 구독)

## Conventions
- 타입(`SttStatus`)은 `@/hooks/useStt`, 도메인 타입(`Patient`/`Session`/`Soap`/`SessionMeta`)은 `@/lib/types`에서 import
- 상태 저장은 컴포넌트가 아니라 `@/lib/patientStore` / `@/lib/sessionStore` / `@/lib/settings` 경유
- 아이콘은 외부 라이브러리 없이 인라인 SVG 컴포넌트로 작성
