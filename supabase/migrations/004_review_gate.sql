-- Taste Network — migration 004: admin review gate + CAPTCHA-backed submits.
-- Run in Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
--
-- What changes:
--   1. responses.review_status ('pending' | 'approved' | 'rejected').
--      New submissions arrive 'pending' and are invisible to everyone
--      except admins until approved. The column defaults to 'approved'
--      so every response published before this gate stays published —
--      and the app server always writes 'pending' explicitly, so the
--      default never fires for new submissions. Re-runs are safe: there
--      is no UPDATE to accidentally re-approve newer pending rows.
--      A trigger (protect_review_status) ensures only admins can change
--      review_status, so creators can't approve their own responses.
--   2. The anonymous INSERT policy is REMOVED. Response inserts now go
--      through the app's own /api/submit-response endpoint (Railway),
--      which verifies a Cloudflare Turnstile CAPTCHA token server-side,
--      re-enforces the migration-003 throttle bounds, and inserts with
--      the service-role key. A script can no longer bypass the CAPTCHA
--      by calling the table directly.
--   3. Read policy: owners and the public see only approved responses;
--      admins see everything (needed for the review queue).
--   4. pending_review_counts(): per-test count of responses awaiting
--      review, for tests the caller owns (or all tests for admins).
--      Creators use it for the "N awaiting review" banner.
--   5. live_response_counts() now counts only approved, non-removed
--      responses (pending ones aren't published yet).

-- === 1. column (default 'approved' = everything existing stays published) ===
alter table public.responses
  add column if not exists review_status text not null default 'approved';

create index if not exists responses_review_idx
  on public.responses (test_id, review_status, created_at desc);

-- allowed values only (idempotent)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'responses_review_status_check') then
    alter table public.responses
      add constraint responses_review_status_check
      check (review_status in ('pending','approved','rejected'));
  end if;
end $$;

-- only admins can CHANGE review_status. The "responses update by owner"
-- policy lets creators update their test's rows (moderation/flags), but
-- without this trigger a creator could approve their own pending responses
-- via direct API calls, bypassing the review queue. The server inserts with
-- the service-role key (INSERT, not UPDATE) so it is unaffected; admins
-- approve through the client with their own JWT where is_admin() is true.
create or replace function public.protect_review_status()
returns trigger language plpgsql as $$
begin
  if new.review_status is distinct from old.review_status and not public.is_admin() then
    raise exception 'only admins can change review_status';
  end if;
  return new;
end $$;

drop trigger if exists responses_protect_review_status on public.responses;
create trigger responses_protect_review_status
  before update of review_status on public.responses
  for each row execute function public.protect_review_status();

-- === 2. anonymous inserts are gone (server endpoint only) ===
drop policy if exists "responses insert on live tests" on public.responses;

-- === 3. reads: only approved is public; admins see all ===
drop policy if exists "responses readable" on public.responses;
create policy "responses readable" on public.responses
  for select using (
    public.is_admin() or (
      review_status = 'approved' and (
        demo or exists (
          select 1 from public.tests
          where tests.id = responses.test_id
            and (tests.owner_id = auth.uid() or tests.is_demo)
        )
      )
    )
  );

-- === 4. pending counts for the creator's own tests (or all, for admins) ===
create or replace function public.pending_review_counts()
returns table(test_id text, n bigint)
language sql stable security definer set search_path = public as $$
  select r.test_id, count(*)
  from public.responses r
  join public.tests t on t.id = r.test_id
  where r.review_status = 'pending'
    and (public.is_admin() or t.owner_id = auth.uid())
  group by r.test_id;
$$;

-- === 5. honest public counts: only approved, non-removed ===
create or replace function public.live_response_counts()
returns table(test_id text, n bigint)
language sql stable security definer set search_path = public as $$
  select r.test_id, count(*) filter (
    where r.review_status = 'approved'
      and (r.moderation->>'status') <> 'removed'
  )
  from public.responses r
  join public.tests t on t.id = r.test_id
  where t.status = 'live' and not t.is_demo
  group by r.test_id;
$$;
