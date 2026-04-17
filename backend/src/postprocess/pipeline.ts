import { expandAbbreviations } from './abbreviations';
import { normalizeUnits } from './units';
import { normalizeDates, DateFormat } from './dates';

export type PostprocessOptions = {
  dateFormat?: DateFormat;
};

/**
 * Vosk 전사 결과에 대한 의학 특화 후처리 파이프라인.
 * 순서: 약어 → 단위 → 날짜 → 공백 정리.
 */
export function runPostprocess(
  raw: string,
  options: PostprocessOptions = {},
): string {
  if (!raw) return raw;
  const dateFormat = options.dateFormat ?? 'korean';

  let t = raw;
  t = expandAbbreviations(t);
  t = normalizeUnits(t);
  t = normalizeDates(t, dateFormat);
  t = tidyWhitespace(t);
  return t;
}

function tidyWhitespace(text: string): string {
  // 줄바꿈은 보존하면서 공백만 정리
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.?!])/g, '$1')
        .trim(),
    )
    .join('\n');
}
