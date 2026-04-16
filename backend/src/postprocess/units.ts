/**
 * 숫자 + 단위 결합 및 정규화.
 * 예) "5 센티미터" → "5cm", "120 슬래시 80" → "120/80", "120 mmhg" → "120mmHg"
 */

type UnitRule = { match: RegExp; replace: string };

const UNIT_RULES: UnitRule[] = [
  // 길이
  {
    match: /(\d+(?:\.\d+)?)\s*(센티미터|센치미터|쎈티|센치|cm)/gi,
    replace: '$1cm',
  },
  { match: /(\d+(?:\.\d+)?)\s*(밀리미터|미리미터|mm)/gi, replace: '$1mm' },
  { match: /(\d+(?:\.\d+)?)\s*(미터|m)\b/gi, replace: '$1m' },
  // 부피/무게
  { match: /(\d+(?:\.\d+)?)\s*(밀리리터|미리리터|ml|mL)/gi, replace: '$1mL' },
  { match: /(\d+(?:\.\d+)?)\s*(리터|L)\b/gi, replace: '$1L' },
  { match: /(\d+(?:\.\d+)?)\s*(킬로그램|키로그램|kg)/gi, replace: '$1kg' },
  { match: /(\d+(?:\.\d+)?)\s*(그램|g)\b/gi, replace: '$1g' },
  { match: /(\d+(?:\.\d+)?)\s*(밀리그램|미리그램|mg)/gi, replace: '$1mg' },
  // 생체 징후
  { match: /(\d+)\s*(비피엠|bpm)/gi, replace: '$1bpm' },
  { match: /(\d+)\s*(엠엠에이치지|mmhg)/gi, replace: '$1mmHg' },
  { match: /(\d+(?:\.\d+)?)\s*(도|°)\s*(씨|c)\b/gi, replace: '$1°C' },
  { match: /(\d+(?:\.\d+)?)\s*도(?![가-힣])/g, replace: '$1°C' },
  // 혈압 슬래시
  { match: /(\d+)\s*(슬래시|에|\/)\s*(\d+)/g, replace: '$1/$3' },
];

export function normalizeUnits(text: string): string {
  let out = text;
  for (const rule of UNIT_RULES) {
    out = out.replace(rule.match, rule.replace);
  }
  // "5 cm" 처럼 남은 공백 정리 (영문 단위 앞 공백)
  out = out.replace(/(\d)\s+(cm|mm|mL|L|kg|g|mg|bpm|mmHg)\b/g, '$1$2');
  return out;
}
