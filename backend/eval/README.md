# Vosk STT 평가 세트

## 파일 배치
- `audio/*.wav` — 16kHz mono PCM WAV. 파일명 예: `quiet_01.wav`, `noisy_02.wav`, `names_03.wav`
- `reference.txt` — 탭(또는 공백)으로 `파일명 정답전사` 쌍 한 줄씩

## 실행
```bash
cd backend
python eval/run_eval.py --stage baseline
python eval/run_eval.py --stage step_a
python eval/run_eval.py --stage step_b
python eval/run_eval.py --stage step_c --grammar '["시작","정지","도와줘"]'
```

결과를 프로젝트 루트 `DEVELOP.md` 표에 옮겨 기록한다.

## 의존성
```bash
pip install vosk jiwer
```
jiwer 미설치 시 단순 Levenshtein 폴백이 동작한다.
