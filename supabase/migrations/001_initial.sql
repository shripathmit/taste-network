-- Taste Network — initial Supabase schema.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to re-run: every statement is idempotent.
--
-- What this creates:
--   tables: profiles, tests, responses, credit_ledger, pending_credits
--   row-level security so owners see their own data, respondents can only
--     answer live tests, and the demo test stays publicly readable
--   a storage bucket (test-images) for variation uploads
--   a claim_pending_credits() function (anonymous taster credits -> account)
--   the seeded demo test + 14 synthetic demo responses

-- ============================== tables ==============================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tests (
  id text primary key,
  public_id text unique not null,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null default '',
  type text not null default 'anything',
  context text not null default '',
  question text not null default '',
  goal text not null default 'overall',
  variations jsonb not null default '[]',
  config jsonb not null default '{}',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  decision jsonb,
  is_demo boolean not null default false
);

create table if not exists public.responses (
  id text primary key,
  test_id text not null references public.tests(id) on delete cascade,
  session_fp text not null default '',
  choice text not null default '',
  reason text not null default '',
  followup text not null default '',
  confidence text,
  order_shown jsonb not null default '[]',
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  respondent_name text not null default '',
  respondent_email text not null default '',
  respondent_id uuid references public.profiles(id) on delete set null,
  want_more_feedback boolean not null default false,
  flags jsonb not null default '[]',
  moderation jsonb not null default '{"status":"valid","creatorMark":null}',
  demo boolean not null default false,
  -- server-side deduplication: one response per browser fingerprint per test
  unique (test_id, session_fp)
);

create table if not exists public.credit_ledger (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.pending_credits (
  id text primary key,
  match_email text not null default '',
  match_device text not null default '',
  delta integer not null,
  reason text not null default '',
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================== RLS ==============================

alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.responses enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.pending_credits enable row level security;

-- helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  );
$$;

-- ---- profiles ----
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid());

-- ---- tests ----
-- Anyone can read the demo test and live tests (the share link is the access
-- control for respondents). Drafts are visible to the owner and admins only.
drop policy if exists "tests readable" on public.tests;
create policy "tests readable" on public.tests
  for select using (
    is_demo or status = 'live' or owner_id = auth.uid() or public.is_admin()
  );

drop policy if exists "tests insert own" on public.tests;
create policy "tests insert own" on public.tests
  for insert with check (owner_id = auth.uid());

drop policy if exists "tests update own" on public.tests;
create policy "tests update own" on public.tests
  for update using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "tests delete own" on public.tests;
create policy "tests delete own" on public.tests
  for delete using (owner_id = auth.uid() or public.is_admin());

-- ---- responses ----
-- Owners read responses to their own tests; everyone reads demo responses.
drop policy if exists "responses readable" on public.responses;
create policy "responses readable" on public.responses
  for select using (
    demo or public.is_admin() or exists (
      select 1 from public.tests
      where tests.id = responses.test_id
        and (tests.owner_id = auth.uid() or tests.is_demo)
    )
  );

-- Anyone (signed in or not) may answer a live, non-demo test.
drop policy if exists "responses insert on live tests" on public.responses;
create policy "responses insert on live tests" on public.responses
  for insert with check (
    exists (
      select 1 from public.tests
      where tests.id = responses.test_id
        and tests.status = 'live' and not tests.is_demo
    )
  );

-- Only the test owner may moderate (update) responses.
drop policy if exists "responses update by owner" on public.responses;
create policy "responses update by owner" on public.responses
  for update using (
    public.is_admin() or exists (
      select 1 from public.tests
      where tests.id = responses.test_id and tests.owner_id = auth.uid()
    )
  );

-- ---- credit_ledger ----
drop policy if exists "ledger read own" on public.credit_ledger;
create policy "ledger read own" on public.credit_ledger
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "ledger insert own" on public.credit_ledger;
create policy "ledger insert own" on public.credit_ledger
  for insert with check (user_id = auth.uid());

-- ---- pending_credits ----
-- Anonymous tasters earn credits without an account; nobody lists them
-- directly (claiming goes through the function below).
drop policy if exists "pending insert anyone" on public.pending_credits;
create policy "pending insert anyone" on public.pending_credits
  for insert with check (true);

-- Moves unclaimed credits matching the caller's email or device into their
-- ledger. Runs as the table owner so callers never see other people's rows.
create or replace function public.claim_pending_credits(p_device_id text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_total integer := 0;
  r record;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  select lower(email) into v_email from public.profiles where id = v_user_id;
  for r in
    select * from public.pending_credits
    where claimed = false
      and (lower(match_email) = v_email
           or (p_device_id is not null and p_device_id <> '' and match_device = p_device_id))
  loop
    insert into public.credit_ledger(id, user_id, delta, reason)
    values ('cr_' || substr(md5(random()::text), 1, 12), v_user_id, r.delta, r.reason);
    update public.pending_credits set claimed = true where id = r.id;
    v_total := v_total + r.delta;
  end loop;
  return v_total;
end;
$$;

-- ============================== storage ==============================

insert into storage.buckets (id, name, public)
values ('test-images', 'test-images', true)
on conflict (id) do nothing;

drop policy if exists "test images public read" on storage.objects;
create policy "test images public read" on storage.objects
  for select using (bucket_id = 'test-images');

drop policy if exists "test images upload by sign-in" on storage.objects;
create policy "test images upload by sign-in" on storage.objects
  for insert with check (bucket_id = 'test-images' and auth.role() = 'authenticated');

drop policy if exists "test images delete own" on storage.objects;
create policy "test images delete own" on storage.objects
  for delete using (bucket_id = 'test-images' and auth.role() = 'authenticated');

-- Lets a respondent flip only the "keep me in the loop" flag on a response.
-- Single boolean, no data exposure; runs as the table owner.
create or replace function public.set_want_more_feedback(p_response_id text, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.responses set want_more_feedback = p_value
  where id = p_response_id;
end;
$$;

-- Public response counts for live tests (content stays private; the Give
-- page shows honest counts without exposing individual responses).
create or replace function public.live_response_counts()
returns table(test_id text, n bigint)
language sql stable security definer set search_path = public as $$
  select r.test_id, count(*) filter (where (r.moderation->>'status') <> 'removed')
  from public.responses r
  join public.tests t on t.id = r.test_id
  where t.status = 'live' and not t.is_demo
  group by r.test_id;
$$;

-- ============================== demo seed ==============================

-- Demo test: publicly readable, nobody owns it, responses are read-only.
insert into public.tests
  (id, public_id, owner_id, title, type, context, question, goal, variations, config,
   status, created_at, published_at, is_demo)
values
  ('t_demo0001', 'demo-headline', null,
   'Which landing-page headline is clearest?', 'headline',
   'We''re a small team launching a scheduling tool for home-service businesses (plumbers, electricians). The headline sits above the hero section of our marketing site.',
   'Which headline makes this product clearest?', 'clarity',
   '[{"id":"v_a","label":"Option A","text":"Scheduling software for home-service pros","imageUrl":"","externalUrl":""},
     {"id":"v_b","label":"Option B","text":"Never miss a job again","imageUrl":"","externalUrl":""},
     {"id":"v_c","label":"Option C","text":"The calendar your crew will actually use","imageUrl":"","externalUrl":""}]',
   '{"targetResponses":15,"access":"link","invitedEmails":[],"anonymous":"visible","deadline":0,"requireReason":true}',
   'live', now() - interval '3 days', now() - interval '3 days', true)
on conflict (id) do nothing;

-- 14 synthetic demo responses (labeled demo=true, explicitly synthetic).
insert into public.responses
  (id, test_id, session_fp, choice, reason, followup, confidence, order_shown,
   duration_ms, created_at, respondent_name, flags, moderation, demo)
values
  ('r_demo001','t_demo0001','fp_demoseed1','v_a','I run a small HVAC company and this told me exactly what it is in five seconds.','A scheduling app for tradespeople — plumbers, electricians, that sort of thing.','very','["v_b","v_a","v_c"]',45000, now()-interval '3 days' + interval '3 hours','Maya','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo002','t_demo0001','fp_demoseed2','v_a','Says what it is and who it''s for. No guessing.','Software that helps home service businesses manage their schedules.','somewhat','["v_b","v_a","v_c"]',52000, now()-interval '3 days' + interval '6 hours','Tom','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo003','t_demo0001','fp_demoseed3','v_a','The word ''pros'' makes me feel like it''s built for people like me, not generic.','It''s a booking/scheduling tool aimed at trades businesses.','very','["v_b","v_a","v_c"]',59000, now()-interval '3 days' + interval '9 hours','Priya','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo004','t_demo0001','fp_demoseed4','v_a','Clear and boring in the best way. I know what I''d be clicking into.','Scheduling software for home service companies.','somewhat','["v_b","v_a","v_c"]',66000, now()-interval '3 days' + interval '12 hours','Sam','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo005','t_demo0001','fp_demoseed5','v_a','Immediately understood. The others made me think too hard.','A scheduling product for home-service professionals.','very','["v_b","v_a","v_c"]',73000, now()-interval '3 days' + interval '15 hours','Alex','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo006','t_demo0001','fp_demoseed6','v_a','It names the category and the audience. Done.','Tool for scheduling jobs if you run a home-service business.','somewhat','["v_b","v_a","v_c"]',80000, now()-interval '3 days' + interval '18 hours','Jo','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo007','t_demo0001','fp_demoseed7','v_a','As someone who hires plumbers, I''d trust a company whose tools speak plainly.','Scheduling software for trades businesses.','somewhat','["v_b","v_a","v_c"]',87000, now()-interval '3 days' + interval '21 hours','Rae','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo008','t_demo0001','fp_demoseed8','v_b','It''s punchy and I felt the pain point instantly — missed jobs are real money.','Something about not missing appointments... maybe a reminder app?','somewhat','["v_b","v_a","v_c"]',94000, now()-interval '2 days','Kim','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo009','t_demo0001','fp_demoseed9','v_b','Emotional hook works, but I couldn''t tell what the product actually does.','Honestly not sure — could be reminders, could be a CRM.','not','["v_b","v_a","v_c"]',101000, now()-interval '2 days' + interval '3 hours','Lee','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo010','t_demo0001','fp_demoseed10','v_b','Made me curious enough to keep reading, which is the job of a headline.','I think it''s about keeping track of jobs so nothing slips.','somewhat','["v_b","v_a","v_c"]',108000, now()-interval '2 days' + interval '6 hours','Noah','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo011','t_demo0001','fp_demoseed11','v_c','''Actually use'' is doing a lot of work — it hints the problem is adoption, which is true for crews.','A calendar/scheduling app designed for field crews.','somewhat','["v_b","v_a","v_c"]',115000, now()-interval '2 days' + interval '9 hours','Ivy','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo012','t_demo0001','fp_demoseed12','v_c','Warm and human, but I''d want a subhead telling me what it is.','Some kind of team calendar for service workers.','not','["v_b","v_a","v_c"]',122000, now()-interval '2 days' + interval '12 hours','Omar','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo013','t_demo0001','fp_demoseed13','none','None of them say what makes this different from the ten other schedulers I''ve tried.','A scheduling tool for home services, I think — but they all blur together.','somewhat','["v_b","v_a","v_c"]',129000, now()-interval '2 days' + interval '15 hours','Zed','[]','{"status":"valid","creatorMark":null}',true),
  ('r_demo014','t_demo0001','fp_demoseed14','context','I need to know the price model before I can judge — is this per tech or per office?','A scheduling product for home-service businesses.','not','["v_b","v_a","v_c"]',136000, now()-interval '2 days' + interval '18 hours','Ana','[]','{"status":"valid","creatorMark":null}',true)
on conflict (id) do nothing;
