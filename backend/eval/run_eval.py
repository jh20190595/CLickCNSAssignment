#!/usr/bin/env python3
"""
Vosk 한국어 STT 정확도 평가 스크립트.

사용법:
    python run_eval.py --stage baseline
    python run_eval.py --stage step_a    # SetWords + conf filter
    python run_eval.py --stage step_b    # + N-best
    python run_eval.py --stage step_c --grammar '["시작","정지","도와줘"]'

입력:
    backend/eval/audio/*.wav       16kHz mono PCM WAV
    backend/eval/reference.txt     각 줄: <wav_basename>\t<reference_text>

출력:
    stdout에 전체 WER/CER 및 파일별 결과 표 출력.
    결과는 수동으로 DEVELOP.md 표에 옮겨 기록한다.

의존성: vosk, jiwer (없으면 단순 편집거리로 계산)
"""

import argparse
import json
import os
import sys
import wave
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
AUDIO_DIR = EVAL_DIR / "audio"
REF_FILE = EVAL_DIR / "reference.txt"
MODEL_PATH = os.environ.get(
    "VOSK_MODEL_PATH",
    str((EVAL_DIR.parent / "model").resolve()),
)


def edit_distance(a, b):
    """단순 Levenshtein (jiwer 미설치 시 폴백)."""
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            curr.append(
                min(
                    prev[j] + 1,
                    curr[j - 1] + 1,
                    prev[j - 1] + (ca != cb),
                )
            )
        prev = curr
    return prev[-1]


def wer(ref: str, hyp: str) -> float:
    try:
        import jiwer
        return jiwer.wer(ref, hyp)
    except ImportError:
        r = ref.split()
        h = hyp.split()
        if not r:
            return 0.0 if not h else 1.0
        return edit_distance(r, h) / len(r)


def cer(ref: str, hyp: str) -> float:
    try:
        import jiwer
        return jiwer.cer(ref, hyp)
    except ImportError:
        r = list(ref.replace(" ", ""))
        h = list(hyp.replace(" ", ""))
        if not r:
            return 0.0 if not h else 1.0
        return edit_distance(r, h) / len(r)


def load_references():
    if not REF_FILE.exists():
        print(f"reference file not found: {REF_FILE}", file=sys.stderr)
        sys.exit(1)
    refs = {}
    for line in REF_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t", 1) if "\t" in line else line.split(None, 1)
        if len(parts) != 2:
            continue
        name, text = parts
        refs[name] = text.strip()
    return refs


def transcribe(wav_path: Path, stage: str, grammar: str | None):
    from vosk import Model, KaldiRecognizer

    model = Model(MODEL_PATH)
    if stage == "step_c" and grammar:
        rec = KaldiRecognizer(model, 16000, grammar)
    else:
        rec = KaldiRecognizer(model, 16000)

    use_words = stage != "baseline"
    rec.SetWords(use_words)
    if stage in ("step_b", "step_c"):
        rec.SetMaxAlternatives(3)

    with wave.open(str(wav_path), "rb") as wf:
        if wf.getframerate() != 16000 or wf.getnchannels() != 1:
            raise RuntimeError(f"{wav_path.name}: need 16kHz mono")
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            rec.AcceptWaveform(data)
        result = json.loads(rec.FinalResult())

    return extract_text(result, stage)


def extract_text(result: dict, stage: str) -> str:
    alts = result.get("alternatives")
    if alts:
        best = max(alts, key=lambda a: a.get("confidence", 0.0))
        return best.get("text", "")
    if stage == "baseline":
        return result.get("text", "")
    words = result.get("result") or []
    kept = [w["word"] for w in words if w.get("conf", 1.0) >= 0.6]
    return " ".join(kept) if kept else result.get("text", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--stage",
        choices=["baseline", "step_a", "step_b", "step_c"],
        required=True,
    )
    ap.add_argument("--grammar", help='step_c용 JSON 배열 문자열')
    args = ap.parse_args()

    refs = load_references()
    wavs = sorted(AUDIO_DIR.glob("*.wav"))
    if not wavs:
        print(f"no wav files in {AUDIO_DIR}", file=sys.stderr)
        sys.exit(1)

    total_wer = 0.0
    total_cer = 0.0
    rows = []
    for wav in wavs:
        ref = refs.get(wav.name) or refs.get(wav.stem)
        if ref is None:
            print(f"skip (no reference): {wav.name}", file=sys.stderr)
            continue
        hyp = transcribe(wav, args.stage, args.grammar)
        w = wer(ref, hyp)
        c = cer(ref, hyp)
        total_wer += w
        total_cer += c
        rows.append((wav.name, ref, hyp, w, c))

    n = len(rows)
    print(f"\n=== stage: {args.stage}  (n={n}) ===")
    print(f"{'file':<30}{'WER':>8}{'CER':>8}  hyp")
    for name, ref, hyp, w, c in rows:
        print(f"{name:<30}{w:>8.3f}{c:>8.3f}  {hyp}")
    if n:
        print(f"\nAverage WER: {total_wer / n:.3f}")
        print(f"Average CER: {total_cer / n:.3f}")


if __name__ == "__main__":
    main()
