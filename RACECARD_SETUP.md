# Today's Card — Setup

Phase 1 adds a **Today's Card** section to `index.html`: pick a real track and
race, see the real runners (horse, jockey, trainer, weight, form, odds), and
send one into the calculator with **Use this horse**. Paper bets only — no
real money.

## How it works

```
Browser -> Netlify Function (netlify/functions/racecards.js)
        -> RapidAPI "Horse Racing USA" API
```

The API key lives **only** in the Netlify Function's environment — never in
browser code. The function caches responses (racecards/results 10 min, race
detail 3 min) so the free tier lasts.

Until the key is configured, the section shows a clearly labeled **DEMO CARD**
with fictional names.

## 1. Get a RapidAPI key (free)

1. Create an account at https://rapidapi.com (or log in).
2. Open the **Horse Racing USA** API page:
   https://rapidapi.com/ortegalex/api/horse-racing-usa
3. Click **Subscribe to Test** / subscribe to the **Basic** plan (free,
   50 requests/day).
4. Copy your key: RapidAPI header `X-RapidAPI-Key` (shown on the API page
   under "Header Parameters" once subscribed, or in your RapidAPI dashboard
   under My Apps).

Notes:

- The free tier is small on purpose — the function cache is what makes it
  workable. Don't call the upstream API from the browser directly.
- One third-party test of this API noted coverage "does not appear to be
  thorough" and may miss some tracks. After setup, check that your tracks
  appear on a race day before relying on it.

## 2. Deploy this repo to Netlify

1. In Netlify: **Add new site → Import an existing project** → pick this
   repo (`Odds-calculator-app`).
2. Build settings: **no build command**, publish directory = the repo root
   (leave defaults). `netlify.toml` wires up the functions folder.
3. **Site settings → Environment variables → Add**: `RAPIDAPI_KEY` = the key
   from step 1.
4. **Deploys → Trigger deploy** (env vars only apply after a fresh deploy).

## 3. Apply this patch, commit, push

```bash
git apply odds-racecard-phase1.patch
git add -A
git commit -m "Add Today's Card: real racecards + runners feeding the calculator (paper betting)"
git push origin main
```

## 4. Open the Netlify URL — not file://

Netlify Functions only run on the deployed site. Opening `index.html` from
your computer shows the **demo card** (expected — there is no function to
call from `file://`).

## What the API returns (for future work)

- `GET /racecards?date=YYYY-MM-DD` → races: `id_race, course, date,
  distance, age, finished, canceled, offtime`. No runners, no race number —
  race numbers are derived from card order per course.
- `GET /race/{id_race}` → race + `horses[]`: `horse, id_horse, jockey,
  trainer, age, weight, number, non_runner, form, position, distance_beaten,
  odds, poolData`.
- `GET /results?date=YYYY-MM-DD` → finished races (same shape as racecards).
  Phase 2 will use this + `position` to settle paper bets (estimated vs.
  actual payout).

## Honest limits (teach these, don't hide them)

- US racing is pari-mutuel: the odds shown are a snapshot, and the final
  payout depends on the closing pool. The calculator's number is an
  **estimate** until the race is official.
- The odds string format from the API is not documented; the app converts
  fractional/decimal/American formats and leaves anything else blank for
  manual entry.
- This API is a RapidAPI marketplace listing, not Equibase-official data.
  Fine for a prototype/education tool — verify licensing before any
  commercial use.
