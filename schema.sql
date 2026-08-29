-- 부표 (Buoy) — Supabase 스키마 v1
-- Supabase 대시보드 → SQL Editor에 통째로 붙여넣고 실행.
-- auth.users는 Supabase가 이미 만들어 둔 테이블. profiles가 그걸 확장한다.

-- ─────────────────────────────────────────────
-- 1. 프로필 (고정 닉네임 + 들키기 빈도)
-- ─────────────────────────────────────────────
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  nickname           text not null unique,
  weekly_quota       int  not null default 3,   -- 주 몇 회 들킬지 (1,3,5,7)
  paused_until       date,                      -- 2주 쉬기. null이면 활성
  quota_locked_until date,                      -- 빈도를 내렸을 때 적용 시작일
  birth_year         int,
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. 일기 (하루 여러 편 가능 — 저장할 때마다 새 글)
-- ─────────────────────────────────────────────
create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  wrote_on   date not null,
  raw_text   text,           -- 음성 원문 등 정리 전 텍스트 (없으면 null)
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 3. 문단 — 발췌의 실제 단위. 여기가 이 앱의 심장이다.
-- ─────────────────────────────────────────────
create table public.paragraphs (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.entries(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  seq           int  not null,
  text          text not null,   -- ★ 원문. 욕 포함. 절대 덮어쓰지 않는다.
  -- ★ 오늘 배포판은 기본값 true(잠김). LLM 안전 필터가 없으니
  --   사용자가 직접 자물쇠를 푼 문단만 후보가 된다.
  --   나중에 필터를 붙이면 default false 로 뒤집는다.
  locked        boolean not null default true,
  eligible_from date not null,   -- 작성 다음 날. INSTANT_MODE에서는 무시된다
  drawn_count   int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (entry_id, seq)
);

-- 추첨 쿼리가 매일 도는 곳이라 인덱스가 중요하다
create index paragraphs_pool_idx
  on public.paragraphs (user_id, eligible_from)
  where locked = false;

-- ─────────────────────────────────────────────
-- 4. 발췌 예약분 — 낮 크론이 만들고, 밤 크론이 공개 시각을 찍는다
-- ─────────────────────────────────────────────
create type safety_verdict as enum ('pass', 'blocked', 'crisis');

create table public.drafts (
  id              uuid primary key default gen_random_uuid(),
  paragraph_id    uuid not null references public.paragraphs(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  verdict         safety_verdict not null default 'pass',
  block_reason    text,                        -- 사용자에게는 보여주지 않는다
  translated_text text,                        -- ★ 욕 번역본. 원문과 별개 컬럼.
  swaps           jsonb not null default '[]'::jsonb,  -- [{from,to,at}] 점선 밑줄용
  palette         jsonb,                       -- {mood, buttons:[...]}
  prepared_at     timestamptz not null default now(),
  publish_at      timestamptz,                 -- null이면 아직 비공개
  retracted_at    timestamptz,                 -- ★ 회수는 삭제가 아니라 상태
  read_count      int not null default 0
);

create index drafts_feed_idx
  on public.drafts (publish_at desc)
  where publish_at is not null and retracted_at is null;

create index drafts_paragraph_idx on public.drafts (paragraph_id);

-- ─────────────────────────────────────────────
-- 5. 반응
-- ─────────────────────────────────────────────
create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  draft_id   uuid not null references public.drafts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,   -- 'fight' | 'rest' | 'well' | 'good'
  created_at timestamptz not null default now(),
  -- 같은 버튼을 두 번 못 누른다. 다른 버튼은 가능.
  unique (draft_id, user_id, kind)
);

create index reactions_draft_idx on public.reactions (draft_id);

-- ─────────────────────────────────────────────
-- RLS — 남의 일기가 새는 걸 DB 레벨에서 막는다. 선택이 아니다.
-- ─────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.entries    enable row level security;
alter table public.paragraphs enable row level security;
alter table public.drafts     enable row level security;
alter table public.reactions  enable row level security;

-- 프로필: 내 것만.
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- feed 뷰가 profiles와 조인해 닉네임을 내려준다. 공개 발췌를 가진 유저의 닉네임만 예외적으로 읽을 수 있게 한다.
create policy "nickname for published drafts" on public.profiles
  for select using (
    exists (
      select 1 from public.drafts d
      where d.user_id = profiles.id
        and d.publish_at is not null and d.publish_at <= now()
        and d.retracted_at is null
        and d.verdict = 'pass'
    )
  );

-- 일기와 문단: 완전히 내 것만. 남의 것은 어떤 경우에도 못 읽는다.
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own paragraphs" on public.paragraphs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feed 뷰가 paragraphs와 조인한다. 공개된 발췌의 원문 문단만 예외적으로 읽을 수 있게 한다
-- (남의 문단을 통째로 열어주는 게 아니라, 이미 공개가 확정된 발췌 하나에 한해서만).
create policy "paragraph text for published drafts" on public.paragraphs
  for select using (
    exists (
      select 1 from public.drafts d
      where d.paragraph_id = paragraphs.id
        and d.publish_at is not null and d.publish_at <= now()
        and d.retracted_at is null
        and d.verdict = 'pass'
    )
  );

-- 발췌: 내 것은 언제나. 남의 것은 '공개됐고 회수 안 된' 것만.
create policy "own drafts" on public.drafts
  for select using (auth.uid() = user_id);

create policy "published drafts" on public.drafts
  for select using (
    publish_at is not null
    and publish_at <= now()
    and retracted_at is null
    and verdict = 'pass'
  );

-- 반응: 공개된 발췌에만 달 수 있고, 내가 단 것만 지운다.
create policy "read reactions" on public.reactions
  for select using (true);

create policy "insert own reaction" on public.reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.drafts d
      where d.id = draft_id
        and d.publish_at is not null and d.publish_at <= now()
        and d.retracted_at is null
    )
  );

create policy "delete own reaction" on public.reactions
  for delete using (auth.uid() = user_id);

-- ★ 크론(추첨·번역)은 RLS를 우회해야 하므로 service_role 키로 도는
--   서버 라우트에서만 실행한다. 그 키는 절대 클라이언트 번들에 들어가면 안 된다.

-- ─────────────────────────────────────────────
-- 피드 뷰 — "남의 것은 숫자를 숨긴다"는 규칙을
-- 애플리케이션이 아니라 여기서부터 강제한다.
-- ─────────────────────────────────────────────
create or replace view public.feed
with (security_invoker = on) as
select
  d.id,
  d.publish_at,
  coalesce(d.translated_text, p.text) as display_text,
  d.swaps,
  d.palette,
  pr.nickname,
  case when d.user_id = auth.uid()
       then (select count(*) from public.reactions r where r.draft_id = d.id)
       else null end as reaction_count,
  (d.user_id = auth.uid()) as is_mine
from public.drafts d
join public.paragraphs p on p.id = d.paragraph_id
join public.profiles  pr on pr.id = d.user_id
where d.publish_at is not null
  and d.publish_at <= now()
  and d.retracted_at is null
  and d.verdict = 'pass';
