"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitParagraphs } from "@/lib/buoy";
import { drawFromPool } from "@/lib/draw";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function saveEntry(formData: FormData) {
  const text = String(formData.get("text") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const wroteOn = todayStr();
  const eligibleFrom = addDays(wroteOn, 1);

  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .upsert(
      { user_id: user.id, wrote_on: wroteOn, raw_text: text },
      { onConflict: "user_id,wrote_on" }
    )
    .select("id")
    .single();

  if (entryError || !entry) {
    throw new Error(entryError?.message ?? "일기 저장 실패");
  }

  // 다시 쓰면 문단을 통째로 새로 나눈다 — 잠금 상태는 초기화된다 (오늘 스코프의 단순화).
  await supabase.from("paragraphs").delete().eq("entry_id", entry.id);

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length) {
    const rows = paragraphs.map((p, seq) => ({
      entry_id: entry.id,
      user_id: user.id,
      seq,
      text: p,
      eligible_from: eligibleFrom,
    }));
    const { error: insertError } = await supabase.from("paragraphs").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/");
}

export async function toggleLock(paragraphId: string, locked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("paragraphs")
    .update({ locked })
    .eq("id", paragraphId)
    .eq("user_id", user.id);

  revalidatePath("/");
}

export async function drawForMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const instant = process.env.INSTANT_MODE === "true";

  let query = supabase
    .from("paragraphs")
    .select("id, text")
    .eq("user_id", user.id)
    .eq("locked", false);

  if (!instant) {
    query = query.lte("eligible_from", todayStr());
  }

  const { data: pool } = await query;
  const result = drawFromPool(pool ?? []);
  if (!result) return;

  const { data: picked } = await supabase
    .from("paragraphs")
    .select("drawn_count")
    .eq("id", result.paragraphId)
    .single();

  // drafts는 select 정책만 있고 insert 정책이 없다 (schema.sql 설계 의도: 추첨은 admin 전용).
  const admin = createAdminClient();
  const { error } = await admin.from("drafts").insert({
    paragraph_id: result.paragraphId,
    user_id: user.id,
    verdict: result.verdict,
    translated_text: result.translatedText,
    swaps: result.swaps,
    publish_at: instant ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);

  await supabase
    .from("paragraphs")
    .update({ drawn_count: (picked?.drawn_count ?? 0) + 1 })
    .eq("id", result.paragraphId);

  revalidatePath("/");
}

/** 발췌 하나엔 유저당 반응 하나만. 같은 걸 다시 누르면 해제, 다른 걸 누르면 갈아탄다. */
export async function setReaction(draftId: string, kind: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: draft } = await supabase
    .from("drafts")
    .select("user_id")
    .eq("id", draftId)
    .maybeSingle();
  if (draft?.user_id === user.id) return; // 자기 글에는 반응 못 남긴다.

  const { data: existing } = await supabase
    .from("reactions")
    .select("id, kind")
    .eq("draft_id", draftId)
    .eq("user_id", user.id);

  const alreadyThisKind = existing?.some((r) => r.kind === kind) ?? false;

  if (existing && existing.length) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("draft_id", draftId)
      .eq("user_id", user.id);
    if (error) {
      console.error("reaction delete failed:", error.code, error.message);
      throw new Error(error.message);
    }
  }

  if (!alreadyThisKind) {
    const { error } = await supabase
      .from("reactions")
      .insert({ draft_id: draftId, user_id: user.id, kind });
    if (error) {
      console.error("reaction insert failed:", error.code, error.message);
      throw new Error(error.message);
    }
  }

  revalidatePath("/feed");
}
