import { runPostprocess } from './pipeline';
import { expandAbbreviations } from './abbreviations';
import { normalizeUnits } from './units';
import { normalizeDates } from './dates';

describe('postprocess/abbreviations', () => {
  it('한글 음성 약어를 영문 약어로 변환한다', () => {
    expect(expandAbbreviations('환자는 에이치티엔 병력이 있다')).toBe(
      '환자는 HTN 병력이 있다',
    );
    expect(expandAbbreviations('디엠 의심')).toBe('DM 의심');
    expect(expandAbbreviations('씨 티 촬영 예정')).toBe('CT 촬영 예정');
  });
});

describe('postprocess/units', () => {
  it('숫자와 단위를 결합한다', () => {
    expect(normalizeUnits('크기 5 센티미터')).toBe('크기 5cm');
    expect(normalizeUnits('120 에 80')).toBe('120/80');
    expect(normalizeUnits('체온 37 도')).toBe('체온 37°C');
  });
});

describe('postprocess/dates', () => {
  it('한글 연월일을 숫자 연월일로 변환한다', () => {
    expect(normalizeDates('이천이십육년 사월 십육일')).toBe('2026년 4월 16일');
    expect(normalizeDates('삼월 이십삼일')).toBe('3월 23일');
  });
});

describe('postprocess/pipeline', () => {
  it('파이프라인이 약어·단위·날짜를 모두 처리한다', () => {
    const input = '환자 에이치티엔 병력 5 센티미터 병변 사월 십육일 재검';
    const out = runPostprocess(input);
    expect(out).toContain('HTN');
    expect(out).toContain('5cm');
    expect(out).toContain('4월 16일');
  });

  it('빈 문자열은 그대로 반환한다', () => {
    expect(runPostprocess('')).toBe('');
  });
});
