/**
 * 한국어 음성으로 발화된 의학 약어를 영문 약어로 변환.
 * Vosk가 "HTN"을 "에이치티엔" 또는 "에이치 티 엔"으로 전사하는 경우를 잡는다.
 */

const ABBREVIATIONS: Record<string, string> = {
  에이치티엔: 'HTN',
  '에이치 티 엔': 'HTN',
  디엠: 'DM',
  '디 엠': 'DM',
  씨오피디: 'COPD',
  '씨 오 피 디': 'COPD',
  에이엠아이: 'AMI',
  '에이 엠 아이': 'AMI',
  씨에이치에프: 'CHF',
  '씨 에이치 에프': 'CHF',
  엠알아이: 'MRI',
  '엠 알 아이': 'MRI',
  씨티: 'CT',
  '씨 티': 'CT',
  엑스레이: 'X-ray',
  '엑스 레이': 'X-ray',
  비피: 'BP',
  '비 피': 'BP',
  에이치알: 'HR',
  '에이치 알': 'HR',
  에스피오투: 'SpO2',
  '에스 피 오 투': 'SpO2',
  엔에스알: 'NSR',
  '엔 에스 알': 'NSR',
  유에이: 'UA',
  '유 에이': 'UA',
  씨비씨: 'CBC',
  '씨 비 씨': 'CBC',
  엘에프티: 'LFT',
  '엘 에프 티': 'LFT',
  유알아이: 'URI',
  '유 알 아이': 'URI',
};

const KEYWORD_MAP: Record<string, string> = {
  고혈압: '고혈압',
  당뇨: '당뇨병',
  천식: '천식',
};

export function expandAbbreviations(text: string): string {
  let out = text;
  const sorted = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    const re = new RegExp(escapeRegExp(k), 'g');
    out = out.replace(re, ABBREVIATIONS[k]);
  }
  for (const k of Object.keys(KEYWORD_MAP)) {
    const re = new RegExp(escapeRegExp(k), 'g');
    out = out.replace(re, KEYWORD_MAP[k]);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
