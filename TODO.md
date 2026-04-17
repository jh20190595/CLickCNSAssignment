# TODO — SOAP 진료 기록 디벨롭 작업 순서

레퍼런스(Voice Medic) 대비 차별화 + 의사 UX 향상을 위한 작업 목록.
**Phase 1 → 4 순으로 진행.** 각 Phase는 데모 가능 단위.

---

## Phase 1 — 데이터 모델 / 핵심 차별화 (최우선)

차별화 인상이 가장 크고 이후 작업의 기반이 되는 것부터.

### 1. `Soap` 타입 확장 — CC + P 서브분할
- [x] `frontend/lib/types.ts` — `Soap`에 `chiefComplaint: string` 승격, `plan`을 `{ medication, exam, education, followup }` 객체로 변경
- [x] `EMPTY_SOAP` / `DEFAULT_SESSION_META` 갱신
- [x] `sessionStore` 마이그레이션 — `soap.sessions.v2` → `v3` 키 변경 + 기존 데이터 변환 함수
- [x] `backend/src/llm/llm.service.ts` — 프롬프트에서 CC 별도 추출 + P 4분할 JSON 스키마로 변경
- [x] `frontend/lib/exportFormat.ts` — MD/TXT 출력 포맷 갱신

### 2. 화자 라벨링 (의사/환자)
- [x] `backend/src/postprocess/` — `speakerLabel` 단계 추가 (LLM 호출, 비용 고려해 옵션화)
- [x] WebSocket `transcript_complete` payload 확장 — `text` 외 `segments: { speaker: 'doctor'|'patient', text }[]`
- [x] `frontend/hooks/useStt.ts` — segments 수신·노출
- [x] `RecordingIndicator` / 원문 보기에서 `의사:` `환자:` 라벨 + 색상 차등 렌더
- [x] LLM SOAP 프롬프트가 화자 라벨을 우선 활용하도록 수정

### 3. CC 카드 + P 서브카드 UI
- [x] `SoapEditor.tsx` — 헤더의 `chiefComplaint` input 제거, 본문 최상단에 **CC 카드** 신규 컴포넌트
- [x] `SoapPanel.tsx` — `plan` 전용 변형 추가하거나 `PlanPanel.tsx` 신규 (4개 서브 textarea + 각각 재생성 버튼)
- [x] 그리드 레이아웃 재배치 — CC(전폭) / S·O 한 행 / A 단독 / P 4분할

---

## Phase 2 — 가독성 / 편집 효율 (의사 사용성 직결)

### 4. 원문 ↔ SOAP 좌우 분할 뷰
- [x] `SoapEditor`에 `viewMode: 'soap-only' | 'split'` 토글 — 분할 시 좌측 전사(타임스탬프 + 화자), 우측 SOAP
- [ ] ~~전사 텍스트 드래그 → SOAP 카드로 드롭 = 해당 섹션에 인용 삽입~~ (불필요)

### 5. 시각적 위계 (색상 코딩)
- [x] `SoapPanel`에 `accent` prop — CC(파랑) / S(초록) / O(보라) / A(분홍·강조) / P-약물(노랑) / P-교육(빨강) / P-추후(보라)
- [x] A·P 카드는 보더 두께 / 좌측 컬러바로 비중 강조

### 6. 섹션별 복사 + 키보드 단축키 매크로
- [x] 각 `SoapPanel` 우상단에 복사 아이콘 버튼
- [x] `useHotkeys`에 `Cmd+1~4` (S/O/A/P 복사), `Cmd+Shift+C` (CC 복사) 매핑
- [x] `SettingsModal` 단축키 탭에 노출

---
