-- BLOSSOM 테스트: 길드 공지/이벤트 저장소
-- Supabase SQL Editor에서 한 번 실행합니다. 기존 profiles 데이터는 수정하지 않습니다.
create table if not exists public.guild_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice', 'event')),
  title text not null check (char_length(title) between 2 and 100),
  content text not null check (char_length(content) between 1 and 4000),
  event_at timestamptz null,
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guild_posts_created_at_idx
  on public.guild_posts (created_at desc);
-- 클라이언트의 직접 DB 접근은 허용하지 않습니다.
-- 모든 읽기/쓰기는 blossom-events Edge Function이 로그인/등급을 검사한 뒤 실행합니다.
alter table public.guild_posts enable row level security;
revoke all on table public.guild_posts from public, anon, authenticated;
grant select, insert, update, delete on table public.guild_posts to service_role;
