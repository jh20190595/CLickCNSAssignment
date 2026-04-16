"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import { detectCommand } from "@/lib/voiceCommands";

export type SttStatus = "idle" | "connecting" | "recording" | "processing" | "error";

export type UseSttOptions = {
  settings?: AppSettings;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 4096;
const TYPING_RESUME_MS = 1200;
const NEWLINE_MARKER = "\n";

function clampGain(g: number): number {
  if (!Number.isFinite(g)) return 1.0;
  return Math.max(0.5, Math.min(3.0, g));
}

function stripCommandWords(
  text: string,
  cfg: AppSettings["voiceCommands"],
): string {
  if (!cfg.enabled || !text) return text;
  let out = text;
  if (cfg.stopWord) {
    const re = new RegExp(`\\s*${escapeRegex(cfg.stopWord)}\\s*`, "g");
    out = out.replace(re, " ");
  }
  if (cfg.newlineWord) {
    const re = new RegExp(`\\s*${escapeRegex(cfg.newlineWord)}\\s*`, "g");
    out = out.replace(re, "\n");
  }
  return out.replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function useStt(options: UseSttOptions = {}) {
  const settings = options.settings ?? DEFAULT_SETTINGS;

  const [status, setStatus] = useState<SttStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [finalTexts, setFinalTexts] = useState<string[]>([]);
  const [partialText, setPartialText] = useState<string>("");
  const [isPaused, setIsPaused] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const finalsRef = useRef<string[]>([]);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settingsRef = useRef(settings);
  const stopRecordingRef = useRef<() => void>(() => {});
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const emitSettings = useCallback(() => {
    const s = settingsRef.current;
    socketRef.current?.emit("settings_update", {
      numberCall: s.postprocess.numberCall,
      dateFormat: s.postprocess.dateFormat,
    });
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${BACKEND_URL}/stt`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus((s) => (s === "error" ? "idle" : s));
      emitSettings();
    });
    socket.on("connect_error", () => {
      setStatus("error");
      setError("서버에 연결할 수 없습니다.");
    });

    socket.on("transcript_partial", ({ text }: { text: string }) => {
      setPartialText(text ?? "");
    });

    socket.on("transcript_final", ({ text }: { text: string }) => {
      if (!text) return;
      const match = detectCommand(text, settingsRef.current.voiceCommands);
      if (match) {
        if (match.cleanedText) {
          finalsRef.current.push(match.cleanedText);
        }
        if (match.action === "newline") {
          finalsRef.current.push(NEWLINE_MARKER);
        }
        setFinalTexts([...finalsRef.current]);
        setPartialText("");
        if (match.action === "stop") {
          stopRecordingRef.current?.();
        }
        return;
      }
      finalsRef.current.push(text);
      setFinalTexts([...finalsRef.current]);
      setPartialText("");
    });

    socket.on("transcript_complete", ({ text }: { text: string }) => {
      const fallback = finalsRef.current.join(" ");
      const cleaned = stripCommandWords(
        text ?? fallback,
        settingsRef.current.voiceCommands,
      );
      setFullTranscript(cleaned);
      setPartialText("");
      setStatus("idle");
    });
  }, [emitSettings]);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setFullTranscript("");
    setFinalTexts([]);
    setPartialText("");
    finalsRef.current = [];

    connect();

    try {
      const deviceId = settingsRef.current.audio.deviceId;
      const userAdjustsGain = settingsRef.current.audio.gain !== 1.0;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: !userAdjustsGain,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = clampGain(settingsRef.current.audio.gain);
      gainNodeRef.current = gainNode;

      const processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (pausedRef.current) return;
        const float32 = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < float32.length; i++) sum += float32[i];
        const dc = sum / float32.length;
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i] - dc));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        socketRef.current?.emit("audio_chunk", int16.buffer);
      };

      source.connect(gainNode);
      gainNode.connect(processor);
      processor.connect(audioContext.destination);

      emitSettings();
      pausedRef.current = false;
      setIsPaused(false);
      setStatus("recording");
    } catch {
      setStatus("error");
      setError("마이크 접근 권한이 필요합니다.");
    }
  }, [connect, emitSettings]);

  const stopRecording = useCallback(() => {
    setStatus("processing");

    processorRef.current?.disconnect();
    processorRef.current = null;
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    socketRef.current?.emit("audio_end");

    setTimeout(() => {
      setStatus((current) => {
        if (current !== "processing") return current;
        setFullTranscript((prev) => prev || finalsRef.current.join(" "));
        return "idle";
      });
    }, 1500);
  }, []);

  const pauseStream = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeStream = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setIsPaused(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setFullTranscript("");
    setFinalTexts([]);
    setPartialText("");
    finalsRef.current = [];
  }, []);

  const insertNewline = useCallback(() => {
    finalsRef.current.push(NEWLINE_MARKER);
    setFinalTexts([...finalsRef.current]);
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  // 설정의 후처리 섹션 변경 시 서버로 전파
  useEffect(() => {
    if (socketRef.current?.connected) emitSettings();
  }, [settings.postprocess, emitSettings]);

  // 게인 런타임 반영
  useEffect(() => {
    const node = gainNodeRef.current;
    const ctx = audioContextRef.current;
    if (node && ctx) {
      node.gain.setValueAtTime(clampGain(settings.audio.gain), ctx.currentTime);
    }
  }, [settings.audio.gain]);

  // 타이핑 중 오디오 청크 전송 일시정지
  useEffect(() => {
    if (status !== "recording") return;

    const handleKeydown = () => {
      pauseStream();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        resumeStream();
      }, TYPING_RESUME_MS);
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [status, pauseStream, resumeStream]);

  return {
    status,
    error,
    fullTranscript,
    finalTexts,
    partialText,
    isPaused,
    startRecording,
    stopRecording,
    resetTranscript,
    insertNewline,
  };
}
