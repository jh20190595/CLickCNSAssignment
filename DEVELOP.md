# STT 정확도 개선 기록

Vosk 한국어 모델 `vosk-model-small-ko-0.22`를 유지한 상태에서 전처리·Recognizer 튜닝으로 정확도를 끌어올린 과정과 측정 결과를 기록한다.

## 배경

- 사용 모델: **vosk-model-small-ko-0.22** (82MB, WER 28.1 — Zeroth Test, 공식 수치)
- 본래 계획은 풀 모델 `vosk-model-ko-0.22`(~1.2GB)로 교체였으나, 공식·커뮤니티 전수 조사 결과 **Vosk 한국어는 small 모델이 유일**함을 확인 (alphacephei 공식 404, HuggingFace 미러 동일). 커뮤니티가 발전시킨 한국어 STT는 전부 Whisper/wav2vec2로 넘어감.
- 과제 조건상 Vosk 사용이 강제되므로 모델 교체 없이 개선 가능한 모든 경로를 적용.

## 적용한 개선안

| # | 위치 | 변경 | 기대 효과 |
|---|------|------|----------|
| 1 | `frontend/hooks/useStt.ts` `getUserMedia` | `echoCancellation`, `noiseSuppression`, `autoGainControl` 켜기 + `sampleRate/channelCount` 힌트 | 배경 소음·에코 감소, 볼륨 편차 보정 |
| 2 | `frontend/hooks/useStt.ts` `onaudioprocess` | Float32 → Int16 변환 전 DC offset 제거 | 저주파 바이어스로 인한 오인식 감소 |
| 3 | `backend/src/stt/stt_worker.py` | `SetWords(True)` + `conf < 0.6` 단어 제거 | 신뢰도 낮은 단어 배제로 false positive 감소 |
| 4 | `backend/src/stt/stt_worker.py` | `SetMaxAlternatives(3)` + 평균 confidence 최고 가설 선택 | N-best 중 최선 선택으로 WER 소폭 개선 |
| 5 | `backend/src/stt/stt_worker.py` | `VOSK_GRAMMAR_JSON` 환경변수로 문법 제한 모드 (선택적) | 도메인 어휘 한정 시 정확도 급상승 |

환경변수(백엔드):
- `VOSK_CONF_THRESHOLD` (기본 0.6, 0이면 필터 끔)
- `VOSK_MAX_ALTERNATIVES` (기본 3, 1 이하면 끔)
- `VOSK_GRAMMAR_JSON` (미설정이면 자유 인식)

## 테스트 세트

`backend/eval/audio/`에 16kHz mono WAV 배치, `backend/eval/reference.txt`에 정답 전사 기록.

- Quiet (조용한 환경, 짧은 문장): _N_개
- Noisy (배경 소음): _N_개
- Names/Numbers (고유명사·숫자·긴 문장): _N_개

## 측정 절차

```bash
cd backend
pip install vosk jiwer
python eval/run_eval.py --stage baseline
python eval/run_eval.py --stage step_a
python eval/run_eval.py --stage step_b
python eval/run_eval.py --stage step_c --grammar '["시작","정지","도와줘"]'
```

## 결과

### 전체 평균 (run_eval.py 출력을 옮겨 기록)

| 단계 | 구성 | WER | CER | Δ WER | 비고 |
|------|------|-----|-----|-------|------|
| Baseline | 변경 없음 | _TBD_ | _TBD_ | — | |
| Step A | +SetWords, conf<0.6 제거 | _TBD_ | _TBD_ | _TBD_ | |
| Step B | +SetMaxAlternatives(3) | _TBD_ | _TBD_ | _TBD_ | |
| Step C | +문법 제한 (도메인 한정) | _TBD_ | _TBD_ | _TBD_ | 도메인 세트에서만 측정 |

### 카테고리별 (선택)

| 카테고리 | Baseline WER | Step B WER | Δ |
|---------|--------------|-----------|---|
| Quiet | _TBD_ | _TBD_ | _TBD_ |
| Noisy | _TBD_ | _TBD_ | _TBD_ |
| Names/Numbers | _TBD_ | _TBD_ | _TBD_ |

### 대표 오인식 예시

| Reference | Baseline hyp | Step B hyp |
|-----------|--------------|------------|
| _TBD_ | _TBD_ | _TBD_ |

## 프론트엔드 A/B (수동)

WAV 입력으로는 프론트엔드 전처리 효과를 측정할 수 없어, 동일 환경에서 같은 문장을 **(변경 전 / 변경 후)** 실시간 녹음하여 `transcript_final`을 비교한다.

| # | 환경 | 발화 | Before | After |
|---|------|------|--------|-------|
| 1 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 2 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 3 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 4 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 5 | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## 결론 및 교훈

- 가장 효과적이었던 기법: _TBD_
- 역효과가 있었던 경우: _TBD_ (예: 문법 제한 모드는 도메인 외 발화에서 공백/[unk] 속출)
- 한계: 모델 자체의 WER 하한(공식 28.1)을 깨지 못함. 파이프라인 튜닝의 상한선 확인.
- 향후 개선 방향:
  - AudioWorklet 이관 (`ScriptProcessorNode` deprecated)
  - webrtcvad 기반 발화 분절로 긴 문장 오류 누적 억제
  - Zeroth 데이터셋 + Kaldi chain 학습으로 자체 한국어 Vosk 모델 제작 (과제 범위 외)

## 관련 파일

- `frontend/hooks/useStt.ts`
- `backend/src/stt/stt_worker.py`
- `backend/eval/run_eval.py`
- `backend/eval/reference.txt`
- `backend/eval/README.md`
