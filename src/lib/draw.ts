import { pickOne, translateSwears, tooMuchSwearing, tooShort, type Swap } from "@/lib/buoy";

export type ParagraphCandidate = { id: string; text: string };

export type DrawResult = {
  paragraphId: string;
  verdict: "pass" | "blocked";
  translatedText: string;
  swaps: Swap[];
};

/** 후보 풀에서 하나를 뽑고 욕을 치환한다. 순수 함수 — DB 접근 없음. */
export function drawFromPool(pool: ParagraphCandidate[]): DrawResult | null {
  const eligible = pool.filter((p) => !tooShort(p.text));
  const picked = pickOne(eligible);
  if (!picked) return null;

  const translated = translateSwears(picked.text);

  return {
    paragraphId: picked.id,
    verdict: tooMuchSwearing(picked.text) ? "blocked" : "pass",
    translatedText: translated.text,
    swaps: translated.swaps,
  };
}
