/**
 * 한글 숫자 + 날짜 표현을 정규화.
 * 예) "사월 십육일" → "4월 16일", "이천이십육년 사월 십육일" → "2026년 4월 16일"
 *
 * 범위: 1~99 사이 한글 수사만 처리. 연도는 이천 + 십/이십 ... + 숫자/일/이 조합을 근사 인식.
 *
 * format 옵션 (연·월·일 전부 있을 때만 최종 형식 변환):
 *   - "korean":  2026년 4월 16일   (기본)
 *   - "iso":     2026-04-16
 *   - "dot":     2026.04.16
 *   - "english": Apr 16, 2026
 */

export type DateFormat = 'korean' | 'iso' | 'dot' | 'english';

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDate(
  y: number,
  m: number,
  d: number,
  format: DateFormat,
): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  switch (format) {
    case 'iso':
      return `${y}-${mm}-${dd}`;
    case 'dot':
      return `${y}.${mm}.${dd}`;
    case 'english':
      return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
    case 'korean':
    default:
      return `${y}년 ${m}월 ${d}일`;
  }
}

const DIGIT_ONES: Record<string, number> = {
  공: 0,
  영: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  칠: 7,
  팔: 8,
  구: 9,
};

// 한글 1~99 수사 (예: 십육, 이십삼, 삼십, 구)
function parseKoreanSmall(num: string): number | null {
  if (!num) return null;
  if (num === '십') return 10;
  const tensMatch = num.match(
    /^([일이삼사오육칠팔구])?십([일이삼사오육칠팔구])?$/,
  );
  if (tensMatch) {
    const tens = tensMatch[1] ? DIGIT_ONES[tensMatch[1]] : 1;
    const ones = tensMatch[2] ? DIGIT_ONES[tensMatch[2]] : 0;
    return tens * 10 + ones;
  }
  if (DIGIT_ONES[num] !== undefined) return DIGIT_ONES[num];
  return null;
}

// "이천이십육" 같은 연도 (2000~2099 범위) 근사 파싱
function parseKoreanYear(num: string): number | null {
  const m = num.match(/^이천([일이삼사오육칠팔구십]+)?$/);
  if (!m) return null;
  if (!m[1]) return 2000;
  const rest = parseKoreanSmall(m[1]);
  if (rest === null) return null;
  return 2000 + rest;
}

export function normalizeDates(
  text: string,
  format: DateFormat = 'korean',
): string {
  let out = text;

  // 연도: "이천이십육년" → "2026년"
  out = out.replace(/이천[일이삼사오육칠팔구십]*년/g, (m) => {
    const y = parseKoreanYear(m.replace('년', ''));
    return y !== null ? `${y}년` : m;
  });

  // 월: "사월" "십이월" → "4월" "12월"
  out = out.replace(
    /([일이삼사오육칠팔구십]{1,4})월/g,
    (m: string, num: string) => {
      const n = parseKoreanSmall(num);
      return n !== null && n >= 1 && n <= 12 ? `${n}월` : m;
    },
  );

  // 일: "십육일" "이십삼일" → "16일" "23일"
  out = out.replace(
    /([일이삼사오육칠팔구십]{1,4})일/g,
    (m: string, num: string) => {
      // "일"이 한 글자만으로 오는 경우 (1일 의미) 애매하므로 최소 2글자일 때만 처리
      if (num.length < 2) return m;
      const n = parseKoreanSmall(num);
      return n !== null && n >= 1 && n <= 31 ? `${n}일` : m;
    },
  );

  // 시: "세시 삼십분" → "3시 30분"
  out = out.replace(
    /([일이삼사오육칠팔구십]{1,3})시/g,
    (m: string, num: string) => {
      const n = parseKoreanSmall(num);
      return n !== null && n >= 1 && n <= 24 ? `${n}시` : m;
    },
  );
  out = out.replace(
    /([일이삼사오육칠팔구십]{1,4})분/g,
    (m: string, num: string) => {
      if (num.length < 2) return m;
      const n = parseKoreanSmall(num);
      return n !== null && n >= 0 && n <= 59 ? `${n}분` : m;
    },
  );

  // 연·월·일 3요소가 모두 있을 때만 지정된 format으로 재포맷.
  // 부분 날짜("4월 16일", "2026년")는 그대로 한국어 표기 유지.
  if (format !== 'korean') {
    out = out.replace(
      /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
      (_match, y: string, mo: string, d: string) =>
        formatDate(Number(y), Number(mo), Number(d), format),
    );
  }

  return out;
}
