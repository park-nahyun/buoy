import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderSegments, REACTIONS, FEED_DAILY_LIMIT, type Swap } from "@/lib/buoy";
import { toggleReaction } from "../actions";

type FeedRow = {
  id: string;
  publish_at: string;
  display_text: string;
  swaps: Swap[];
  nickname: string;
  reaction_count: number | null;
  is_mine: boolean;
};

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: drafts } = await supabase
    .from("feed")
    .select("id, publish_at, display_text, swaps, nickname, reaction_count, is_mine")
    .order("publish_at", { ascending: false })
    .limit(FEED_DAILY_LIMIT);

  const rows = (drafts ?? []) as FeedRow[];
  const draftIds = rows.map((d) => d.id);

  const mine = new Set<string>();
  if (draftIds.length) {
    const { data: myReactions } = await supabase
      .from("reactions")
      .select("draft_id, kind")
      .eq("user_id", user.id)
      .in("draft_id", draftIds);
    for (const r of myReactions ?? []) mine.add(`${r.draft_id}:${r.kind}`);
  }

  return (
    <main className="write-screen">
      <header className="page-header">
        <h1 className="brand">표류</h1>
        <Link href="/" className="btn-ghost btn-small">
          오늘로
        </Link>
      </header>

      {rows.length === 0 && <p className="sub">오늘은 아직 아무것도 안 떠내려왔어.</p>}

      <ul className="paragraph-list">
        {rows.map((d) => (
          <li key={d.id} className="drift-card">
            <p className="paragraph-text">
              {renderSegments(d.display_text ?? "", d.swaps ?? []).map((seg, i) =>
                seg.swapped ? (
                  <span key={i} className="swap">
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </p>

            <div className="drift-meta">
              <span>{d.nickname}</span>
              {d.is_mine && d.reaction_count !== null && (
                <span>반응 {d.reaction_count}</span>
              )}
            </div>

            <div className="reaction-row">
              {REACTIONS.map((r) => {
                const active = mine.has(`${d.id}:${r.kind}`);
                return (
                  <form key={r.kind} action={toggleReaction.bind(null, d.id, r.kind)}>
                    <button
                      className={`reaction-btn${active ? " active" : ""}`}
                      type="submit"
                    >
                      {r.label}
                    </button>
                  </form>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
