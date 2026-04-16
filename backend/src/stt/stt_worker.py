#!/usr/bin/env python3
"""
Vosk STT 워커 프로세스
NestJS SttService가 이 스크립트를 child_process로 실행함

stdin:  바이너리 메시지 프로토콜
  - 1바이트: 메시지 타입 (0x01=audio_chunk, 0x02=audio_end, 0x03=reset)
  - 4바이트: 데이터 길이 (big-endian uint32)
  - N바이트: PCM Int16 오디오 데이터 (audio_chunk만)

stdout: JSON 라인
  - {"type":"partial","text":"..."}\n
  - {"type":"final","text":"..."}\n

환경변수:
  VOSK_MODEL_PATH       모델 디렉토리 (기본 ./model)
  VOSK_CONF_THRESHOLD   단어 신뢰도 컷오프 (기본 0.6, 0이면 비활성)
  VOSK_MAX_ALTERNATIVES N-best 개수 (기본 3, 0/1이면 비활성)
  VOSK_GRAMMAR_JSON     JSON 배열 문자열. 지정 시 문법 제한 모드로 동작
"""

import sys
import os
import json
import struct

MODEL_PATH = os.environ.get("VOSK_MODEL_PATH", "./model")
CONF_THRESHOLD = float(os.environ.get("VOSK_CONF_THRESHOLD", "0.6"))
MAX_ALTERNATIVES = int(os.environ.get("VOSK_MAX_ALTERNATIVES", "3"))
GRAMMAR_JSON = os.environ.get("VOSK_GRAMMAR_JSON", "").strip()


def log(msg):
    print(f"[stt_worker] {msg}", file=sys.stderr, flush=True)


def emit(data: dict):
    sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def make_recognizer(model, KaldiRecognizer):
    if GRAMMAR_JSON:
        rec = KaldiRecognizer(model, 16000, GRAMMAR_JSON)
    else:
        rec = KaldiRecognizer(model, 16000)
    rec.SetWords(True)
    if MAX_ALTERNATIVES and MAX_ALTERNATIVES > 1:
        rec.SetMaxAlternatives(MAX_ALTERNATIVES)
    return rec


def pick_best_text(result: dict) -> str:
    """
    SetMaxAlternatives 사용 시 result에 "alternatives" 배열이 담긴다.
    평균 confidence가 가장 높은 가설의 text를 반환하고, 그 가설의 단어 중
    CONF_THRESHOLD 미만은 제거한다.
    단일 결과(alternatives 없음)는 result.result 배열로 동일 필터 적용.
    """
    alts = result.get("alternatives")
    if alts:
        def score(a):
            return a.get("confidence", 0.0)
        best = max(alts, key=score)
        return best.get("text", "")

    words = result.get("result")
    if not words:
        return result.get("text", "")
    if CONF_THRESHOLD <= 0:
        return result.get("text", "")
    kept = [w["word"] for w in words if w.get("conf", 1.0) >= CONF_THRESHOLD]
    return " ".join(kept)


def main():
    try:
        from vosk import Model, KaldiRecognizer
    except ImportError:
        log("vosk not installed")
        emit({"type": "error", "text": "vosk not available"})
        sys.exit(1)

    if not os.path.exists(MODEL_PATH):
        log(f"Model not found at {MODEL_PATH}")
        emit({"type": "error", "text": "model not found"})
        sys.exit(1)

    log(
        f"Loading model from {MODEL_PATH} "
        f"(conf={CONF_THRESHOLD}, nbest={MAX_ALTERNATIVES}, "
        f"grammar={'on' if GRAMMAR_JSON else 'off'})"
    )
    model = Model(MODEL_PATH)
    rec = make_recognizer(model, KaldiRecognizer)
    log("Model loaded, ready")
    emit({"type": "ready"})

    stdin = sys.stdin.buffer

    while True:
        hdr = stdin.read(1)
        if not hdr:
            break

        msg_type = hdr[0]

        if msg_type == 0x01:  # audio_chunk
            len_bytes = stdin.read(4)
            if len(len_bytes) < 4:
                break
            data_len = struct.unpack(">I", len_bytes)[0]
            data = stdin.read(data_len)

            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text = pick_best_text(result)
                if text:
                    emit({"type": "segment", "text": text})
            else:
                partial = json.loads(rec.PartialResult())
                text = partial.get("partial", "")
                if text:
                    emit({"type": "partial", "text": text})

        elif msg_type == 0x02:  # audio_end → 최종 결과
            result = json.loads(rec.FinalResult())
            text = pick_best_text(result)
            emit({"type": "final", "text": text})

        elif msg_type == 0x03:  # reset
            rec = make_recognizer(model, KaldiRecognizer)


if __name__ == "__main__":
    main()
