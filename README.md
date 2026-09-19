# Taste Network

**A human taste network that helps you choose what to ship.**

Founders, creators, designers, and marketers upload 2–5 versions of something they're deciding on. Real humans compare the options, pick what resonates, and explain why. **No AI judges your work — real people make the call.**

## Run it

This MVP is a static app with a Node static server. The backend is Supabase
(Postgres + Auth + Storage). Serve the folder with the two env vars set:

```bash
cd taste-network
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_ANON_KEY="<anon-public-key>" \
npm start
# open http://localhost:8080
```

`server.js` injects both values into the page as `window.TN_ENV` — they never
touch git. On Railway, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment
variables on the service.

### First-time Supabase setup (one time, ~5 minutes)

1. In the Supabase dashboard, open the **SQL Editor**, paste the contents of
   `supabase/migrations/001_initial.sql`, and run it. This creates the tables,
   row-level security policies, the `test-images` storage bucket, and the
   seeded demo test with 14 synthetic responses.
2. **Authentication → Sign In / Providers → Email**: turn **"Confirm email" OFF**
   for the smoothest MVP signup (or leave it on — the app handles the
   "check your email" state).
3. Sign up in the app, then make yourself admin:
   `update public.profiles set is_admin = true where email = 'you@example.com';`

No build step. Without the env vars the app renders with empty data (local
preview mode); image uploads fall back to compressed data-URLs.

## What's built

- **Landing page** — hero, 3-step explainer, "No AI judges your work" trust statement, example result with mock data, footer
- **Auth** — Supabase Auth: email/password + real magic-link emails; onboarding with role picker ("I want feedback" / "I like giving feedback" / "Both")
- **Creator dashboard** — Draft / Live / Closed statuses, response counts, create / view results / edit draft / copy share link / close / reopen
- **5-step test wizard** — type cards → context (title, context, question, goal lens) → 2–5 variations (reorder, delete, image upload with compression; audio/video noted as future) → feedback config (response target, link vs. invite-only, anonymous mode, deadline, always-on written reasoning) → review & publish with share screen (copy link, email invite, preview, go to results)
- **Respondent flow** (`#/t/[public-id]`) — no account needed, calm mobile-friendly pages, one option at a time, randomized order, choice + required written reason + dynamic follow-up per goal + confidence rating, thank-you screen that never reveals results
- **Results dashboard** — honest preference distribution ("Among the people who responded…"), per-option liked/questioned quotes, "None of these" and "Need more context" as first-class categories, Points of disagreement, "What people thought this was", decision reflection prompt with saved note, creator moderation (useful / not useful / flag / hide), and an opt-in **"Organize feedback themes"** button whose output is labeled *"Organized themes from human feedback — not an AI judgment or recommendation"* with direct excerpts under each theme
- **Feedback quality** — browser fingerprint, one response per test per browser, honeypot field, 20-char minimum on reasoning, exact-duplicate detection, completion timing with "implausibly fast" flags (kept for review, never auto-deleted), anonymous-session identifiers
- **Credits** — non-monetary ledger; thoughtful feedback earns 1 credit (claimable after signup); displayed everywhere but never blocks creation; `flags.creditsRequired` in `assets/js/config.js` can gate publishing later
- **Admin** (`#/admin`, allowlist in `assets/js/config.js` → `adminEmails`) — users, tests, responses, flagged-review queue (valid / hidden / removed), metrics: new users, tests created/published, responses, completion rate, avg. response time, repeat creators

## Demo data

The migration seeds a demo test ("Which landing-page headline is clearest?",
`#/demo-results`) with 14 explicitly synthetic responses so every screen is
explorable immediately. The demo test is publicly readable but read-only —
responses can't be submitted against it.

## Supabase backend

The data layer is isolated in `assets/js/store.js` (same API the views use,
backed by an in-memory cache refreshed from Supabase on every navigation) and
auth in `assets/js/auth.js` (Supabase Auth: password + real magic-link emails).

| App concept | Supabase |
|---|---|
| users | Supabase Auth + `profiles` table (id, email, name, role, is_admin) |
| tests | `tests` table (variations/config/decision as jsonb) |
| responses | `responses` table, `UNIQUE(test_id, session_fp)` dedup |
| credits | `credit_ledger` table |
| anonymous taster credits | `pending_credits` + `claim_pending_credits()` function |
| magic links | `supabase.auth.signInWithOtp` (real emails) |
| variation images | `test-images` storage bucket (public read, signed-in upload) |

Row-Level Security: test owners read their own tests and responses; anyone can
read live tests and the demo test; anyone (signed in or not) may insert a
response on a live, non-demo test; only owners moderate. Admins (via
`profiles.is_admin`) see everything.

## Production notes

- Fingerprint/duplicate/one-per-session enforcement is now server-side via the
  unique constraint; the browser check is a courtesy on top.
- Image uploads go to Supabase Storage with client-side compression.
- Still to add before opening tests to the public: rate limiting + CAPTCHA on
  the respondent endpoint, and production email deliverability checks.
- Wire Stripe when you're ready for paid tests/payouts — the ledger schema already supports it (`delta`, `reason`, timestamps).

## Design

Warm off-white (`#FAF7F1`), dark charcoal ink, muted terracotta accent, Fraunces display + Inter body, generous spacing, ARIA labels, keyboard navigability, `prefers-reduced-motion` respected. No gradients, no sparkles, no robots.
