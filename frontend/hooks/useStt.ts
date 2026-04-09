"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type SttStatus = "idle" | "connecting" | "recording" | "processing" | "error";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 4096; // samples per chunk

export function useStt() {
  const [status, setStatus] = useState<SttStatus>("idle");
  const [partialText, setPartialText] = useState("");
  const [finalTexts, setFinalTexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${BACKEND_URL}/stt`, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("idle"));
    socket.on("connect_error", () => {
      setStatus("error");
      setError("서버에 연결할 수 없습니다.");
    });

    socket.on("transcript_partial", ({ text }: { text: string }) => {
      if (text) setPartialText(text);
    });

    socket.on("transcript_final", ({ text }: { text: string }) => {
      if (text) {
        setFinalTexts((prev) => [...prev, text]);
      }
      setPartialText("");
    });
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    connect();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16 PCM
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        socketRef.current?.emit("audio_chunk", int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setStatus("recording");
    } catch (e) {
      setStatus("error");
      setError("마이크 접근 권한이 필요합니다.");
    }
  }, [connect]);

  const stopRecording = useCallback(() => {
    setStatus("processing");

    processorRef.current?.disconnect();
    processorRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    socketRef.current?.emit("audio_end");
    setTimeout(() => setStatus("idle"), 500);
  }, []);

  const clearTexts = useCallback(() => {
    setFinalTexts([]);
    setPartialText("");
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [connect]);

  return {
    status,
    partialText,
    finalTexts,
    error,
    startRecording,
    stopRecording,
    clearTexts,
  };
}
