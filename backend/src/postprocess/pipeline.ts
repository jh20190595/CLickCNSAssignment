import { expandAbbreviations } from './abbreviations';
import { normalizeUnits } from './units';
import { normalizeDates, DateFormat } from './dates';
import {
  convertNumberCalls,
  NumberCallOptions,
  DEFAULT_NUMBER_CALL,
} from './numberCall';

export type PostprocessOptions = {
  numberCall?: NumberCallOptions;
  dateFormat?: DateFormat;
};

/**
 * Vosk 전사 결과에 대한 의학 특화 후처리 파이프라인.
 * 순서: 약어 → 단위 → 날짜 → 번호 호출 → 공백 정리.
 *
 * 번호 호출은 날짜 변환 이후에 둬서 날짜 내부의 "일/이/삼" 조각이
 * 숫자 마커로 오변환되지 않도록 한다.
 */
export function runPostprocess(
  raw: string,
  options: PostprocessOptions = {},
): string {
  if (!raw) return raw;
  const numberCall = options.numberCall ?? DEFAULT_NUMBER_CALL;
  const dateFormat = options.dateFormat ?? 'korean';

  let t = raw;
  t = expandAbbreviations(t);
  t = normalizeUnits(t);
  t = normalizeDates(t, dateFormat);
  t = convertNumberCalls(t, numberCall);
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
