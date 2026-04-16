import { Injectable, Logger } from '@nestjs/common';

export interface SoapMeta {
  patientLabel?: string;
  visitType?: string;
  chiefComplaint?: string;
}

export interface SoapResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const EMPTY: SoapResult = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

const SYSTEM_PROMPT = `당신은 한국어 의료 면담 전사를 SOAP 양식으로 분류하는 임상 보조자입니다.
- S(주관적): 환자 호소, 증상, 병력, 발화 내용
- O(객관적): 활력징후, 신체진찰, 검사/영상 소견 등 관찰 가능한 정보
- A(평가): 진단/감별진단 및 임상적 판단
- P(계획): 처방, 검사 오더, 추적, 환자 교육, 재방문 계획
각 섹션에 직접 추론할 수 없는 정보는 쓰지 마십시오. 반드시 JSON 한 개만 반환하고, 다른 설명은 금지합니다.
형식: {"subjective":"","objective":"","assessment":"","plan":""}`;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  async classifySoap(
    transcript: string,
    meta: SoapMeta = {},
  ): Promise<SoapResult> {
    const text = transcript?.trim();
    if (!text) return EMPTY;

    const userPrompt = buildUserPrompt(text, meta);

    if (process.env.ANTHROPIC_API_KEY) {
      return this.callAnthropic(userPrompt);
    }
    if (process.env.OPENAI_API_KEY) {
      return this.callOpenAI(userPrompt);
    }

    this.logger.warn(
      'LLM API key가 설정되지 않음. 전체 전사를 S 섹션에 복사합니다.',
    );
    return { ...EMPTY, subjective: text };
  }

  private async callAnthropic(userPrompt: string): Promise<SoapResult> {
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    const content = data?.content?.[0]?.text ?? '';
    return parseSoapJson(content);
  }

  private async callOpenAI(userPrompt: string): Promise<SoapResult> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content ?? '';
    return parseSoapJson(content);
  }
}

function buildUserPrompt(transcript: string, meta: SoapMeta): string {
  const lines: string[] = [];
  if (meta.patientLabel) lines.push(`환자: ${meta.patientLabel}`);
  if (meta.visitType) lines.push(`방문 유형: ${meta.visitType}`);
  if (meta.chiefComplaint) lines.push(`주증상: ${meta.chiefComplaint}`);
  lines.push('', '--- 진료 전사 ---', transcript);
  return lines.join('\n');
}

function parseSoapJson(raw: string): SoapResult {
  const cleaned = stripCodeFence(raw).trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) return EMPTY;
  try {
    const obj = JSON.parse(
      cleaned.slice(start, end + 1),
    ) as Partial<SoapResult>;
    return {
      subjective: String(obj.subjective ?? ''),
      objective: String(obj.objective ?? ''),
      assessment: String(obj.assessment ?? ''),
      plan: String(obj.plan ?? ''),
    };
  } catch {
    return EMPTY;
  }
}

function stripCodeFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}
