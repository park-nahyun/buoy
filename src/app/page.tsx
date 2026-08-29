import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut, saveEntry, toggleLock, drawForMe } from "./actions";
import { renderSegments, type Swap } from "@/lib/buoy";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  const wroteOn = todayStr();
  const { data: entry } = await supabase
    .from("entries")
    .select("id, raw_text")
    .eq("user_id", user.id)
    .eq("wrote_on", wroteOn)
    .maybeSingle();

  let paragraphs: { id: string; text: string; locked: boolean }[] = [];
  if (entry) {
    const { data } = await supabase
      .from("paragraphs")
      .select("id, text, locked")
      .eq("entry_id", entry.id)
      .order("seq", { ascending: true });
    paragraphs = data ?? [];
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
          defaultValue={entry?.raw_text ?? ""}
        />
        <button className="btn" type="submit">
          저장
        </button>
      </form>

      {paragraphs.length > 0 && (
        <section className="card">
          <p className="sub">자물쇠 푼 문단만 나중에 후보가 돼.</p>
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
