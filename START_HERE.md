# 클로드 코드에 붙여넣을 첫 프롬프트

압축을 풀고 그 폴더에서 `claude`를 실행한 뒤, 아래를 그대로 붙여넣으면 된다.

---

```
CLAUDE.md와 schema.sql, src/lib/buoy.ts를 먼저 읽어줘.

부표(Buoy)라는 익명 일기 웹앱을 오늘 안에 Vercel에 배포하는 게 목표야.
기획은 CLAUDE.md에 다 정리돼 있고, 거기 적힌 결정은 이미 논의를 마친 거라
다시 제안하지 말고 그대로 구현해줘.

지금 있는 것: package.json, tsconfig.json, next.config.mjs, .env.example,
.gitignore, schema.sql, src/lib/buoy.ts (코어 로직, 순수 함수)

만들어야 할 것은 CLAUDE.md의 "만들어야 할 파일" 섹션에 있어.

빌드 순서도 CLAUDE.md에 있는데, 1번(빈 페이지 배포 성공)은 내가 직접 할 테니
2번부터 시작하자. 먼저 Supabase 클라이언트 세 개(client/server/admin)와
middleware.ts, 그리고 매직링크 로그인부터 만들어줘.

Tailwind는 쓰지 말고 globals.css에 직접 써줘. 팔레트는 CLAUDE.md에 있어.
```

---

## 그 전에 네가 할 것 (15분)

1. **Supabase 프로젝트 생성** → SQL Editor에 `schema.sql` 통째로 붙여넣고 실행
2. Settings → API 에서 세 값 복사 → `.env.local` 만들기 (`.env.example` 참고)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Authentication → URL Configuration 에서 리디렉션 URL 등록
   - `http://localhost:3000/auth/callback`
   - `https://<배포주소>/auth/callback`
4. `npm install` → `npm run dev` 로 뜨는지 확인
5. GitHub 리포 만들어 push → Vercel 연결 → **환경변수 4개 등록**
   (`INSTANT_MODE=true` 포함) → 빈 페이지 배포 성공 확인

**5번을 먼저 하는 게 중요해.** 다 만들고 밤에 배포하면 환경변수랑 빌드 에러로 막힌다.

---

## 막히면 나한테 가져올 것

- Supabase RLS 때문에 데이터가 안 읽히는 경우 → **정책을 고치지 끄지는 마**
- 매직링크 콜백이 안 돌아오는 경우 (redirect URL 등록 누락이 대부분)
- 점선 밑줄 렌더링 — `renderSegments()`가 조각을 주니까 `<span>`으로 감싸면 된다
