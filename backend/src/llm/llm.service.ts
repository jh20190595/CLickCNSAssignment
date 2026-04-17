import { Injectable, Logger } from '@nestjs/common';

export type SpeakerLabel = 'doctor' | 'patient';

export interface Utterance {
  speaker: SpeakerLabel;
  text: string;
}

export interface SoapMeta {
  patientLabel?: string;
  visitType?: string;
  chiefComplaint?: string;
}

export interface PlanSections {
  medication: string;
  exam: string;
  education: string;
  followup: string;
}

export interface SoapResult {
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: PlanSections;
}

export interface ClassifyOptions {
  meta?: SoapMeta;
  /** 화자 라벨이 포함된 세그먼트. 제공되면 프롬프트에 [의사]/[환자] 라벨 포함 */
  segments?: Utterance[];
}

const EMPTY_PLAN: PlanSections = {
  medication: '',
  exam: '',
  education: '',
  followup: '',
};

const EMPTY: SoapResult = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: { ...EMPTY_PLAN },
};

const SOAP_SYSTEM_PROMPT = `당신은 한국어 의료 면담 전사를 SOAP 양식으로 분류하는 임상 보조자입니다.

전사에 [의사] / [환자] 화자 라벨이 포함되어 있으면 그 구분을 최우선 단서로 활용하십시오.
- [의사] 발화: 주로 문진/진찰/처방/교육 내용. 진단·평가(A)·계획(P)·관찰(O)의 주 원천.
- [환자] 발화: 주관적 호소·병력·증상(S)·주증상(CC)의 주 원천.

각 섹션 정의:
- chiefComplaint(CC, 주증상): 한 문장으로 간결하게. 환자가 내원한 가장 핵심 호소 (예: "3일 전부터 기침과 발열").
- subjective(S, 주관적): 환자 호소의 상세, 병력, 복약/알레르기, 증상 양상·기간·경과 등 환자 발화 기반 정보.
- objective(O, 객관적): 활력징후, 신체진찰 소견, 검사·영상 결과 등 관찰/측정 가능한 정보.
- assessment(A, 평가): 진단·감별진단, 임상적 판단과 근거.
- plan(P, 계획)은 4개 서브섹션으로 분할하여 작성:
  - medication: 처방/약물 (약물명·용량·용법)
  - exam: 검사/오더 (랩, 영상, 추가 검사 의뢰)
  - education: 환자 교육 (생활습관, 자가관리, 주의사항)
  - followup: 추후/재방문 (재방문 주기, 리퍼, 경과 관찰 지시)

규칙:
1) 전사에서 직접 추론할 수 없는 정보는 만들어 쓰지 말고 해당 필드를 빈 문자열로 두십시오.
2) CC는 S의 요약이어도 되지만 한 문장, 20자 내외로 압축하십시오.
3) Plan 서브섹션에서 해당 내용이 없으면 빈 문자열("")을 사용하십시오. null/누락 금지.
4) 반드시 JSON 객체 하나만 반환하십시오. 코드펜스·서문·설명 금지.

형식:
{"chiefComplaint":"","subjective":"","objective":"","assessment":"","plan":{"medication":"","exam":"","education":"","followup":""}}`;

const SPEAKER_SYSTEM_PROMPT = `당신은 한국어 의료 면담 전사에서 각 발화의 화자를 분류하는 보조자입니다.

입력은 순서가 있는 발화 배열입니다. 각 발화를 "doctor"(의사) 또는 "patient"(환자) 중 하나로 라벨링하십시오.

단서:
- 의사: 문진(어디가/언제부터/얼마나), 진찰 소견 서술, 진단 설명, 처방/검사 오더, 생활 습관 교육, 재방문 안내.
- 환자: 증상 호소, 병력/가족력 언급, 복약 이력, 질문에 대한 답변.

규칙:
1) 입력 배열과 같은 길이의 라벨 배열을 반환. 누락 금지.
2) 확실치 않으면 "doctor"로 두되, 명백한 환자 호소는 "patient"로.
3) JSON 객체 하나만 반환: {"labels":["doctor","patient",...]}. 코드펜스/설명 금지.`;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  async classifySoap(
    transcript: string,
    metaOrOptions: SoapMeta | ClassifyOptions = {},
  ): Promise<SoapResult> {
    const options: ClassifyOptions = isClassifyOptions(metaOrOptions)
      ? metaOrOptions
      : { meta: metaOrOptions };
    const meta = options.meta ?? {};
    const segments = options.segments;

    const text = transcript?.trim();
    if (!text && !(segments && segments.length)) return cloneEmpty();

    const userPrompt = buildSoapUserPrompt(text ?? '', meta, segments);

    if (process.env.ANTHROPIC_API_KEY) {
      return this.callAnthropicSoap(userPrompt);
    }
    if (process.env.GEMINI_API_KEY) {
      return this.callGeminiSoap(userPrompt);
    }
    if (process.env.OPENAI_API_KEY) {
      return this.callOpenAISoap({
        userPrompt,
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      });
    }

    this.logger.warn(
      'LLM API key가 설정되지 않음. 전체 전사를 S 섹션에 복사합니다.',
    );
    return {
      ...cloneEmpty(),
      chiefComplaint: meta.chiefComplaint ?? '',
      subjective: text ?? segments?.map((s) => s.text).join(' ') ?? '',
    };
  }

  /**
   * 입력 세그먼트 배열 각각에 대해 화자(doctor/patient) 라벨을 부여.
   * LLM 키가 없으면 전부 "doctor"로 폴백.
   */
  async labelSpeakers(segments: string[]): Promise<SpeakerLabel[]> {
    const trimmed = segments.map((s) => s.trim()).filter((s) => s.length > 0);
    if (trimmed.length === 0) {
      return segments.map(() => 'doctor');
    }
    const hasKey =
      !!process.env.ANTHROPIC_API_KEY ||
      !!process.env.GEMINI_API_KEY ||
      !!process.env.OPENAI_API_KEY;
    if (!hasKey) {
      this.logger.warn(
        'LLM API key가 설정되지 않음. 화자 라벨링을 건너뛰고 모두 의사로 처리합니다.',
      );
      return segments.map(() => 'doctor');
    }

    const userPrompt = buildSpeakerUserPrompt(segments);
    let labels: SpeakerLabel[] = [];
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        labels = await this.callAnthropicSpeaker(userPrompt);
      } else if (process.env.GEMINI_API_KEY) {
        labels = await this.callGeminiSpeaker(userPrompt);
      } else {
        labels = await this.callOpenAISpeaker({
          userPrompt,
          apiKey: process.env.OPENAI_API_KEY!,
          baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        });
      }
    } catch (e) {
      this.logger.error(
        `화자 라벨링 실패, 모두 의사로 폴백: ${e instanceof Error ? e.message : String(e)}`,
      );
      return segments.map(() => 'doctor');
    }

    return reconcileLabels(segments, labels);
  }

  // --- SOAP ---

  private async callAnthropicSoap(userPrompt: string): Promise<SoapResult> {
    const content = await this.callAnthropic(
      SOAP_SYSTEM_PROMPT,
      userPrompt,
      1024,
    );
    return parseSoapJson(content);
  }

  private async callGeminiSoap(userPrompt: string): Promise<SoapResult> {
    const content = await this.callGemini(SOAP_SYSTEM_PROMPT, userPrompt);
    return parseSoapJson(content);
  }

  private async callOpenAISoap(opts: OpenAIOpts): Promise<SoapResult> {
    const content = await this.callOpenAICompatible(
      SOAP_SYSTEM_PROMPT,
      opts,
      true,
    );
    return parseSoapJson(content);
  }

  // --- Speaker ---

  private async callAnthropicSpeaker(
    userPrompt: string,
  ): Promise<SpeakerLabel[]> {
    const content = await this.callAnthropic(
      SPEAKER_SYSTEM_PROMPT,
      userPrompt,
      512,
    );
    return parseLabelsJson(content);
  }

  private async callGeminiSpeaker(userPrompt: string): Promise<SpeakerLabel[]> {
    const content = await this.callGemini(SPEAKER_SYSTEM_PROMPT, userPrompt);
    return parseLabelsJson(content);
  }

  private async callOpenAISpeaker(opts: OpenAIOpts): Promise<SpeakerLabel[]> {
    const content = await this.callOpenAICompatible(
      SPEAKER_SYSTEM_PROMPT,
      opts,
      true,
    );
    return parseLabelsJson(content);
  }

  // --- HTTP adapters ---

  private async callAnthropic(
    system: string,
    userPrompt: string,
    maxTokens: number,
  ): Promise<string> {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data?.content?.[0]?.text ?? '';
  }

  private async callGemini(
    system: string,
    userPrompt: string,
  ): Promise<string> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private async callOpenAICompatible(
    system: string,
    opts: OpenAIOpts,
    jsonMode: boolean,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: opts.userPrompt },
      ],
    };
    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }
    const res = await fetch(`${opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`LLM API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data?.choices?.[0]?.message?.content ?? '';
  }
}

type OpenAIOpts = {
  userPrompt: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

function isClassifyOptions(
  v: SoapMeta | ClassifyOptions,
): v is ClassifyOptions {
  return (
    v !== null &&
    typeof v === 'object' &&
    ('segments' in v || 'meta' in v) &&
    !('patientLabel' in v) &&
    !('visitType' in v) &&
    !('chiefComplaint' in v)
  );
}

function buildSoapUserPrompt(
  transcript: string,
  meta: SoapMeta,
  segments: Utterance[] | undefined,
): string {
  const lines: string[] = [];
  if (meta.patientLabel) lines.push(`환자: ${meta.patientLabel}`);
  if (meta.visitType) lines.push(`방문 유형: ${meta.visitType}`);
  if (meta.chiefComplaint) lines.push(`힌트(주증상): ${meta.chiefComplaint}`);
  lines.push('', '--- 진료 전사 ---');
  if (segments && segments.length) {
    for (const seg of segments) {
      const label = seg.speaker === 'patient' ? '[환자]' : '[의사]';
      const text = (seg.text ?? '').trim();
      if (text) lines.push(`${label} ${text}`);
    }
  } else {
    lines.push(transcript);
  }
  return lines.join('\n');
}

function buildSpeakerUserPrompt(segments: string[]): string {
  const numbered = segments
    .map((s, i) => `${i + 1}. ${s.trim() || '(공백)'}`)
    .join('\n');
  return [
    `발화 수: ${segments.length}`,
    '',
    '--- 발화 목록 ---',
    numbered,
    '',
    '위 순서대로 각 발화의 화자를 "doctor" 또는 "patient"로 분류해 labels 배열로 반환하세요.',
  ].join('\n');
}

function reconcileLabels(
  segments: string[],
  labels: SpeakerLabel[],
): SpeakerLabel[] {
  const out: SpeakerLabel[] = [];
  for (let i = 0; i < segments.length; i++) {
    const l = labels[i];
    out.push(l === 'patient' ? 'patient' : 'doctor');
  }
  return out;
}

function cloneEmpty(): SoapResult {
  return {
    chiefComplaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: { ...EMPTY_PLAN },
  };
}

function coercePlan(raw: unknown): PlanSections {
  if (typeof raw === 'string') {
    return { ...EMPTY_PLAN, medication: raw };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Record<keyof PlanSections, unknown>>;
    return {
      medication: String(r.medication ?? ''),
      exam: String(r.exam ?? ''),
      education: String(r.education ?? ''),
      followup: String(r.followup ?? ''),
    };
  }
  return { ...EMPTY_PLAN };
}

function parseSoapJson(raw: string): SoapResult {
  const cleaned = stripCodeFence(raw).trim();
  const slice = extractFirstJsonObject(cleaned);
  if (!slice) return cloneEmpty();
  try {
    const obj = JSON.parse(slice) as Partial<SoapResult> & { plan?: unknown };
    return {
      chiefComplaint: String(obj.chiefComplaint ?? ''),
      subjective: String(obj.subjective ?? ''),
      objective: String(obj.objective ?? ''),
      assessment: String(obj.assessment ?? ''),
      plan: coercePlan(obj.plan),
    };
  } catch {
    return cloneEmpty();
  }
}

function parseLabelsJson(raw: string): SpeakerLabel[] {
  const cleaned = stripCodeFence(raw).trim();
  const slice = extractFirstJsonObject(cleaned);
  if (!slice) return [];
  try {
    const obj = JSON.parse(slice) as { labels?: unknown };
    const list = Array.isArray(obj.labels) ? obj.labels : [];
    return list.map((l) => (l === 'patient' ? 'patient' : 'doctor'));
  } catch {
    return [];
  }
}

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function stripCodeFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}
