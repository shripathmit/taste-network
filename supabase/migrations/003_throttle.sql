-- Taste Network — migration 003: server-side response throttling.
-- Run in Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).
--
-- Why: the public response endpoint is insertable by anyone (anonymous).
-- Client-side friction (double-submit lock, per-device gap, honeypot,
-- duplicate/fast flags) stops accidents and casual abuse, but a script can
-- bypass the client entirely. This enforces two generous server-side bounds
-- inside the existing insert policy, so no app-code change is needed:
--   1. per browser fingerprint: max 10 responses in any 10-minute window
--   2. per test circuit breaker: max 60 responses in any 5-minute window
--      (catches fingerprint-rotating floods; far above legit beta traffic)
-- Legitimate respondents never come near either bound. Tighten the numbers
-- here (not in app code) if abuse patterns change.

create or replace function public.response_throttle_ok(p_test_id text, p_fp text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_fp_count integer;
  v_test_count integer;
begin
  select count(*) into v_fp_count from public.responses
  where session_fp = p_fp and created_at > now() - interval '10 minutes';
  if v_fp_count >= 10 then return false; end if;

  select count(*) into v_test_count from public.responses
  where test_id = p_test_id and created_at > now() - interval '5 minutes';
  if v_test_count >= 60 then return false; end if;

  return true;
end;
$$;

-- Indexes so the throttle checks stay cheap under flood conditions.
create index if not exists responses_throttle_fp_idx
  on public.responses (session_fp, created_at desc);
create index if not exists responses_throttle_test_idx
  on public.responses (test_id, created_at desc);

-- Extend the existing public-insert policy with the throttle check.
drop policy if exists "responses insert on live tests" on public.responses;
create policy "responses insert on live tests" on public.responses
  for insert with check (
    exists (
      select 1 from public.tests
      where tests.id = responses.test_id
        and tests.status = 'live' and not tests.is_demo
    )
    and public.response_throttle_ok(responses.test_id, responses.session_fp)
  );
