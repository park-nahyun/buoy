import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateNickname } from "@/lib/nicknames";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "email" | "magiclink" | "signup" | "recovery" | "email_change",
        })
      : { error: new Error("missing code or token_hash") };

  if (error) {
    const status = "status" in error ? error.status : undefined;
    console.error("auth callback failed:", status, error.message, "code:", code, "token_hash:", tokenHash);
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // 닉네임 unique 충돌 시 재시도. RLS는 "own profile"이라 자기 행만 insert 가능.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: user.id, nickname: generateNickname() });
      if (!insertError || insertError.code !== "23505") break;
    }
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
