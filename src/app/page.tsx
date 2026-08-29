import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut, saveEntry, toggleLock, drawForMe } from "./actions";
import { renderSegments, type Swap } from "@/lib/buoy";

const RECENT_ENTRIES_LIMIT = 20;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  const { data: entries } = await supabase
    .from("entries")
    .select("id, raw_text, wrote_on, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_ENTRIES_LIMIT);

  const entryList = entries ?? [];
  const entryIds = entryList.map((e) => e.id);

  const paragraphsByEntry = new Map<
    string,
    { id: string; text: string; locked: boolean }[]
  >();
  if (entryIds.length) {
    const { data: allParagraphs } = await supabase
      .from("paragraphs")
      .select("id, entry_id, text, locked")
      .in("entry_id", entryIds)
      .order("seq", { ascending: true });
    for (const p of allParagraphs ?? []) {
      const list = paragraphsByEntry.get(p.entry_id) ?? [];
      list.push(p);
      paragraphsByEntry.set(p.entry_id, list);
    }
  }

  const { data: drafts } = await supabase
    .from("drafts")
    .select("id, translated_text, swaps, verdict, prepared_at")
    .eq("user_id", user.id)
    .order("prepared_at", { ascending: false })
    .limit(5);

  return (
    <main className="write-screen">
      <header className="page-header">
        <div>
          <h1 className="brand">오늘</h1>
          {profile && <span className="badge">{profile.nickname}</span>}
        </div>
        <div className="header-actions">
          <Link href="/feed" className="btn-ghost btn-small">
            표류 보기
          </Link>
          <form action={signOut}>
            <button className="btn-ghost btn-small" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <form action={saveEntry} className="card">
        <textarea
          className="field textarea"
          name="text"
          rows={10}
          placeholder="오늘 있었던 일, 그냥 적어봐. 문단은 빈 줄로 나뉘어."
        />
        <button className="btn" type="submit">
          저장
        </button>
      </form>

      {entryList.length > 0 && (
        <section className="card">
          <p className="sub">내가 쓴 글. 자물쇠 푼 문단만 나중에 후보가 돼.</p>
          {entryList.map((e) => {
            const paragraphs = paragraphsByEntry.get(e.id) ?? [];
            return (
              <div key={e.id} className="entry-block">
                <p className="entry-date">{e.wrote_on}</p>
                <ul className="paragraph-list">
                  {paragraphs.map((p) => (
                    <li
                      key={p.id}
                      className={`paragraph-card${p.locked ? "" : " unlocked"}`}
                    >
                      <p className="paragraph-text">{p.text}</p>
                      <form action={toggleLock.bind(null, p.id, !p.locked)}>
                        <button className="btn-ghost btn-small" type="submit">
                          {p.locked ? "자물쇠 풀기" : "다시 잠그기"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <form action={drawForMe}>
          <button className="btn" type="submit">
            지금 뽑기 (테스트용)
          </button>
        </form>

        {drafts && drafts.length > 0 && (
          <ul className="paragraph-list">
            {drafts.map((d) => (
              <li key={d.id} className="paragraph-card">
                <p className="paragraph-text">
                  {renderSegments(d.translated_text ?? "", (d.swaps as Swap[]) ?? []).map(
                    (seg, i) =>
                      seg.swapped ? (
                        <span key={i} className="swap">
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                  )}
                  {d.verdict === "blocked" && (
                    <span className="blocked-tag"> (비공개 — 욕 과다)</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
