import { signInWithEmail } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="screen">
      <div className="card">
        <h1 className="brand">부표</h1>
        <p className="sub">매일 적어봐, 가끔만 들켜도 돼.</p>

        <form action={signInWithEmail} className="card">
          <input
            className="field"
            type="email"
            name="email"
            placeholder="이메일"
            defaultValue="youbetterworkguys@gmail.com"
            required
            autoFocus
          />
          <button className="btn" type="submit">
            링크 받기
          </button>
        </form>

        {params.sent && (
          <p className="notice">메일함 확인해봐, 링크가 가 있어.</p>
        )}
        {params.error && (
          <p className="notice error">
            {params.error === "empty"
              ? "이메일부터 적어야지."
              : params.error === "cooldown"
                ? "너무 빨리 눌렀어. 1분만 기다렸다 다시 눌러줘."
                : "뭔가 안 됐어. 다시 해봐."}
          </p>
        )}
      </div>
    </main>
  );
}
