import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
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

  return (
    <main className="screen">
      <div className="card">
        <div className="dialogue">
          <p className="consent">
            당신이 쓴 글의 일부가
            <br />
            예고 없이 공개됩니다.
            <br />
            자물쇠를 푼 문단만 후보가 됩니다.
          </p>
        </div>

        {profile && (
          <>
            <p className="sub" style={{ margin: 0 }}>
              오늘부터 네 이름은
            </p>
            <span className="badge">{profile.nickname}</span>
          </>
        )}

        <Link href="/" className="btn">
          좋아, 시작할게
        </Link>
      </div>
    </main>
  );
}
