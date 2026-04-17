# Backend `src/` 파일 가이드

NestJS 서버. 진입점 `main.ts`, 도메인은 `stt/`, `llm/`, `postprocess/` 3개.

## 루트 파일

- **main.ts** — NestJS 부트스트랩. CORS 전체 허용 후 3001 포트 listen.
- **app.module.ts** — `SttModule` + `LlmModule` 등록.
- **app.controller.ts** / **app.service.ts** — 기본 GET `/` 핸들러 (헬스/샘플용, STT 흐름과 무관).
- **app.controller.spec.ts** — `AppController` 단위 테스트.

## `stt/` — 실시간 음성 전사

- **stt.module.ts** — `SttGateway` + `SttService` 등록.
- **stt.gateway.ts** — socket.io 게이트웨이(namespace `/stt`). 클라이언트별로 세그먼트 버퍼 + 후처리 옵션 맵을 유지.
  - `handleConnection` → `initRecognizer`로 worker 기동, partial/final 콜백 등록
  - `@SubscribeMessage('audio_chunk')` → worker에 Int16 PCM 전달
  - `@SubscribeMessage('settings_update')` → `PostprocessOptions`(`dateFormat`) + `speakerLabel` 저장
  - `@SubscribeMessage('audio_end')` → worker `finalizeResult` → 누적 세그먼트 join → `runPostprocess(raw, options)` → `transcript_complete { raw, text }` emit
  - `handleDisconnect` → 모든 상태 정리 + worker 종료
- **stt.service.ts** — 클라이언트별 `stt_worker.py` 자식 프로세스 Map 관리. 바이너리 프로토콜(1B 타입 + 4B BE 길이 + payload)로 stdin에 써주고, stdout JSON 라인(`partial`/`segment`/`final`/`error`)을 파싱해 gateway 콜백으로 전달. 모델 경로는 `VOSK_MODEL_PATH` env (기본 `cwd/model`).
- **stt_worker.py** — Vosk 한국어 모델 워커. stdin 프로토콜: `audio_chunk(0x01)`, `audio_end(0x02)`, `reset(0x03)`. stdout JSON 타입: `partial`(진행 중), `segment`(문장 확정), `final`(세션 종료 후 잔여 텍스트). 샘플레이트 16000Hz, Int16 PCM 고정. 환경변수 `VOSK_CONF_THRESHOLD`(기본 0.6)·`VOSK_MAX_ALTERNATIVES`(기본 3)·`VOSK_GRAMMAR_JSON`로 인식 동작 조정.

## `postprocess/` — 전사 결과 정규화

`runPostprocess(raw, options?)` 하나로 외부에 노출. 내부 순서: 약어 → 단위 → 날짜 → 공백 정리.

- **pipeline.ts** — `runPostprocess` + `PostprocessOptions` 타입. `tidyWhitespace`는 줄바꿈을 보존하며 공백만 정리.
- **abbreviations.ts** — 한국어 음성 발화 의학 약어를 영문으로 치환 (`에이치티엔` → `HTN`, `디엠` → `DM` 등). 긴 키부터 매칭.
- **units.ts** — 숫자+단위 결합 (`5 센티미터` → `5cm`, `120 슬래시 80` → `120/80`, `37 도` → `37°C`).
- **dates.ts** — 한글 수사(`이천이십육년 사월 십육일`) → 숫자 날짜 정규화. 연·월·일 3요소 모두 있을 때만 `DateFormat`(`korean`/`iso`/`dot`/`english`)에 따라 최종 포맷 변환.
- **speakerLabel.ts** — 옵션 활성 시 문장 배열을 LLM에 보내 각 발화를 `doctor`/`patient`로 라벨링.
- **pipeline.spec.ts** — 파이프라인 단위 테스트 (옵션 조합, 포맷 분기 확인).

## `llm/` — SOAP 분류 (HTTP)

- **llm.module.ts** — `LlmController` + `LlmService` 등록.
- **llm.controller.ts** — `POST /llm/soap` 한 개. body = `{ transcript, meta? }`, response = `SoapResult`.
- **llm.service.ts** — 환경변수에 따라 LLM 백엔드 분기. `ANTHROPIC_API_KEY` 있으면 Anthropic Messages API(기본 `claude-sonnet-4-6`), 없고 `OPENAI_API_KEY` 있으면 OpenAI Chat Completions(기본 `gpt-4o-mini`). 둘 다 없으면 warn 로그 찍고 `{ subjective: transcript, others: "" }` 폴백. 시스템 프롬프트로 JSON 단일 객체만 요구하고 `parseSoapJson`이 코드펜스/서문을 떼어냄.
