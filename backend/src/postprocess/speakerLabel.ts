import { LlmService, SpeakerLabel, Utterance } from '../llm/llm.service';

export interface SpeakerLabelOptions {
  /** 활성화 시 LLM 호출. 비활성화 시 전부 "doctor"로 폴백. */
  enabled: boolean;
}

/**
 * 세그먼트 텍스트 배열에 화자 라벨을 부여해 Utterance[]로 변환.
 * - enabled=false 또는 입력이 비어있으면 LLM 호출 없이 "doctor"로 폴백.
 * - 입력/출력 길이는 항상 동일.
 */
export async function labelSegments(
  segments: string[],
  llm: LlmService,
  options: SpeakerLabelOptions = { enabled: false },
): Promise<Utterance[]> {
  if (segments.length === 0) return [];
  if (!options.enabled) {
    return segments.map((text) => ({ speaker: 'doctor', text }));
  }
  const labels = await llm.labelSpeakers(segments);
  return segments.map<Utterance>((text, i) => ({
    speaker: (labels[i] ?? 'doctor') as SpeakerLabel,
    text,
  }));
}
