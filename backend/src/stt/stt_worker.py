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
"""

import sys
import os
import json
import struct
import wave
import io

MODEL_PATH = os.environ.get("VOSK_MODEL_PATH", "./model")

def log(msg):
    print(f"[stt_worker] {msg}", file=sys.stderr, flush=True)

def emit(data: dict):
    sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()

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

    log(f"Loading model from {MODEL_PATH}")
    model = Model(MODEL_PATH)
    rec = KaldiRecognizer(model, 16000)
    rec.SetWords(False)
    log("Model loaded, ready")
    emit({"type": "ready"})

    stdin = sys.stdin.buffer

    while True:
        # 메시지 타입 (1바이트)
        hdr = stdin.read(1)
        if not hdr:
            break

        msg_type = hdr[0]

        if msg_type == 0x01:  # audio_chunk
            # 데이터 길이 (4바이트 big-endian)
            len_bytes = stdin.read(4)
            if len(len_bytes) < 4:
                break
            data_len = struct.unpack(">I", len_bytes)[0]
            data = stdin.read(data_len)

            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                emit({"type": "partial", "text": result.get("text", "")})
            else:
                partial = json.loads(rec.PartialResult())
                text = partial.get("partial", "")
                if text:
                    emit({"type": "partial", "text": text})

        elif msg_type == 0x02:  # audio_end → 최종 결과
            result = json.loads(rec.FinalResult())
            emit({"type": "final", "text": result.get("text", "")})

        elif msg_type == 0x03:  # reset
            rec = KaldiRecognizer(model, 16000)
            rec.SetWords(False)

if __name__ == "__main__":
    main()
