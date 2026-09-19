-- Taste Network — migration 002: close privilege-escalation holes.
-- Run in Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (idempotent).

-- === 1. Nobody can grant themselves admin via the API ===
-- The old "profiles update own" policy had no column restriction, so any
-- signed-in user could set is_admin = true on their own row. This trigger
-- blocks is_admin changes unless the caller is already an admin or the
-- change comes from a server-side context (SQL editor, no JWT).
create or replace function public.protect_is_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'not allowed to change admin status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_admin on public.profiles;
create trigger profiles_protect_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin();

-- === 2. Credit ledger: deltas must be sane ===
-- The app only ever grants small positive deltas (currently +1 per
-- thoughtful response). Cap inserts so a caller can't mint arbitrary credit.
drop policy if exists "ledger insert own" on public.credit_ledger;
create policy "ledger insert own" on public.credit_ledger
  for insert with check (
    user_id = auth.uid() and delta >= 0 and delta <= 100
  );

-- === 3. Pending credits: same delta cap ===
-- Unclaimed rows are minted by anonymous tasters and later claimed into the
-- ledger; cap them so they can't be used to mint large balances either.
drop policy if exists "pending insert anyone" on public.pending_credits;
create policy "pending insert anyone" on public.pending_credits
  for insert with check (delta >= 0 and delta <= 100);

-- === 4. "Keep me in the loop" toggle: only fresh responses ===
-- Respondents are anonymous, so the toggle can't be tied to an identity.
-- Limiting it to responses created in the last hour keeps the legit flow
-- (toggled right after submitting) while closing drive-by flipping of
-- arbitrary old responses.
create or replace function public.set_want_more_feedback(p_response_id text, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.responses set want_more_feedback = p_value
  where id = p_response_id
    and created_at > now() - interval '1 hour';
end;
$$;
