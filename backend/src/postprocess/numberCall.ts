/**
 * "번호 호출" 변환: 한글 숫자 수사(일/이/삼.../십)를 순서에 따라 번호 마커(1./2./...)로 치환.
 * 위치 기반 — 발화된 한글 숫자의 "등장 순서"를 그대로 번호로 매김.
 *
 * 예) "일 환자 상태 양호 이 혈압 안정 삼 처방 지속"
 *   autoNewline=false, sep="." → "1. 환자 상태 양호 2. 혈압 안정 3. 처방 지속"
 *   autoNewline=true,  sep="." → "1. 환자 상태 양호\n2. 혈압 안정\n3. 처방 지속"
 *   smallNumber=true           → "① 환자 상태 양호\n② 혈압 안정\n③ 처방 지속"
 */

export type NumberCallOptions = {
  enabled: boolean;
  separator: '.' | ')' | '-';
  autoNewline: boolean;
  smallNumber: boolean;
};

export const DEFAULT_NUMBER_CALL: NumberCallOptions = {
  enabled: false,
  separator: '.',
  autoNewline: true,
  smallNumber: false,
};

const KOREAN_NUMBER_WORDS = '일|이|삼|사|오|육|칠|팔|구|십';
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export function convertNumberCalls(
  text: string,
  opts: NumberCallOptions,
): string {
  if (!opts.enabled || !text) return text;

  const pattern = new RegExp(`(^|\\s)(${KOREAN_NUMBER_WORDS})(\\s+)`, 'g');
  let index = 0;

  return text.replace(pattern, (_match, before: string) => {
    index++;
    const marker =
      opts.smallNumber && index >= 1 && index <= 10
        ? CIRCLED[index]
        : `${index}${opts.separator}`;
    const prefix = opts.autoNewline && index > 1 ? '\n' : before;
    return `${prefix}${marker} `;
  });
}
