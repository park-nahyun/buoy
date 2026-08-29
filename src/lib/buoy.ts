/**
 * 부표 — 코어 로직. LLM 없음. 외부 의존성 없음. 전부 순수 함수.
 */

/* ══════════════════════════════════════════════
   1. 문단 나누기
   ══════════════════════════════════════════════ */

/** 빈 줄 기준. 없으면 줄바꿈. 그것도 없으면 통째로 한 문단. */
export function splitParagraphs(text: string): string[] {
  const byBlank = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  const byLine = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return byLine.length ? byLine : [];
}

/* ══════════════════════════════════════════════
   2. 욕 번역 — 순수 문자열 치환. LLM 불필요.
   사전은 우리가 정한다. 유저 제안·투표는 받지 않는다.
   ══════════════════════════════════════════════ */

// ★ 긴 것부터 매칭돼야 한다 ("씨발놈"이 "씨발"보다 먼저)
export const SWEAR_DICT: Record<string, string> = {
  // ㅅㅂ 계열
  "씨발놈": "씨앗님", "시발놈": "씨앗님", "씨발년": "씨앗님", "시발년": "씨앗님",
  "씨발": "씨앗", "시발": "씨앗", "씨빨": "씨앗", "쓰발": "씨앗",
  "씨1발": "씨앗", "시1발": "씨앗", "ㅅㅂ": "씨앗", "ㅆㅂ": "씨앗",
  "십새끼": "십장생", "씹새끼": "십장생", "십새": "십장생", "씹새": "십장생",

  // 개- 계열
  "개새끼": "개나리", "개색기": "개나리", "개세끼": "개나리", "개새": "개나리",
  "개같은": "개나리 같은", "개같네": "개나리 같네", "개놈": "개나리", "개년": "개나리",
  "ㄱㅅㄲ": "개나리",

  // 병신 계열
  "병신": "병아리", "빙신": "병아리", "븅신": "병아리", "ㅂㅅ": "병아리",
  "등신": "등대", "머저리": "머루",

  // 미친 계열
  "미친놈": "미역", "미친년": "미역", "미쳤": "미역났", "미친": "미역 같은",
  "또라이": "또아리", "돌았": "돌맹이됐",

  // 강조어
  "존나": "억수로", "졸라": "억수로", "존내": "억수로", "ㅈㄴ": "억수로",
  "겁나": "억수로", "개빡": "억수로 빡",

  // 지랄 계열
  "지랄": "지렁이", "지럴": "지렁이", "ㅈㄹ": "지렁이",

  // 좆 계열
  "좆같": "조갯살같", "좃같": "조갯살같", "ㅈ같": "조갯살같", "좆나": "조개나",

  // 명령 · 모욕
  "닥쳐": "닭쳐", "닥치": "닭치", "꺼져": "거저가", "뒈져": "뒤척여",
  "죽어라": "쭈꾸미돼라", "재수없": "재수국없",

  // 기타
  "빡친다": "빡국친다", "빡쳐": "빡국쳐", "짜증나": "짜장나",
  "열받": "열무받", "찌질": "찌개질", "한심": "한산", "노답": "노른자",
};

export type Swap = { from: string; to: string; at: number };

export type Translated = {
  text: string;     // 피드에 나갈 문장
  swaps: Swap[];    // 점선 밑줄 렌더링용
  swearCount: number;
};

/** 원문은 건드리지 않는다. 새 문자열을 만들어 돌려준다. */
export function translateSwears(input: string): Translated {
  const keys = Object.keys(SWEAR_DICT).sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(escaped.join("|"), "g");

  const swaps: Swap[] = [];
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input)) !== null) {
    const to = SWEAR_DICT[m[0]];
    out += input.slice(last, m.index);
    swaps.push({ from: m[0], to, at: out.length });
    out += to;
    last = m.index + m[0].length;
  }
  out += input.slice(last);

  return { text: out, swaps, swearCount: swaps.length };
}

/**
 * 치환된 자리에 점선 밑줄을 넣기 위한 조각들.
 * ★ 흔적을 남기는 게 이 기능의 핵심이다. 이 렌더링을 빼면 의미가 없다.
 */
export function renderSegments(
  text: string,
  swaps: Swap[]
): { text: string; swapped: boolean }[] {
  const segs: { text: string; swapped: boolean }[] = [];
  let cur = 0;
  for (const s of [...swaps].sort((a, b) => a.at - b.at)) {
    if (s.at > cur) segs.push({ text: text.slice(cur, s.at), swapped: false });
    segs.push({ text: s.to, swapped: true });
    cur = s.at + s.to.length;
  }
  if (cur < text.length) segs.push({ text: text.slice(cur), swapped: false });
  return segs;
}

/* ══════════════════════════════════════════════
   3. 반응 팔레트 — 오늘은 고정 5개.
   상황별로 바뀌는 건 LLM 붙일 때.
   ══════════════════════════════════════════════ */
export const REACTIONS = [
  { kind: "fight", label: "줘패자" },
  { kind: "rest",  label: "그냥 누워" },
  { kind: "well",  label: "잘했다" },
  { kind: "good",  label: "이 문장 좋다" },
  { kind: "deliver", label: "배달시켜" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

/* ══════════════════════════════════════════════
   4. 추첨 — 반드시 기계가 뽑는다. 사람이 고르면 검증이 무의미해진다.
   ══════════════════════════════════════════════ */

export function shouldDrawToday(weeklyQuota: number): boolean {
  return Math.random() < weeklyQuota / 7;
}

export function pickOne<T>(pool: T[]): T | null {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 욕만 남는 문단은 LLM 없이도 거를 수 있다. */
export function tooMuchSwearing(text: string): boolean {
  const t = translateSwears(text);
  return t.swearCount >= 4 || t.swearCount * 6 > text.length / 2;
}

export function tooShort(text: string): boolean {
  return text.trim().length < 15;
}

/** 오늘 몫이 정해져 있다 — 무한스크롤을 만들지 않기 위한 상한. */
export const FEED_DAILY_LIMIT = 40;
