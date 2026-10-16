# Today's Card — Setup

Phase 1 adds a **Today's Card** section to `index.html`: pick a real track and
race, see the real runners (horse, jockey, trainer, weight, form, draw,
rating, favourite), and send one into the calculator with **Use this horse**.
Paper bets only — no real money.

## How it works

```
Browser -> Netlify Function (netlify/functions/apihorseracing.js)
        -> Apihorseracing API (api.apihorseracing.com/v1)
```

The API key lives **only** in the Netlify Function's environment — never in
browser code. The function caches responses (racecards/results 10 min, race
detail 3 min, result 10 min) so the free tier lasts.

Until the key is configured, the section shows a clearly labeled **DEMO CARD**
with fictional names.

## 1. Get an Apihorseracing key (free)

1. Create an account at https://apihorseracing.com (sign in with Google).
2. Your key is on your account page. It never changes — upgrading a plan
   widens what the same key reaches.
3. The free key reads **yesterday, today, and ahead**, 50 lookups/day,
   60/minute. Starting prices (SPs) and market data are withheld on free
   (they come back null with a note naming the Live plan).

Notes:

- The free tier is small on purpose — the function cache is what makes it
  workable. Don't call the upstream API from the browser directly.
- One key per account. If you upgrade later (Live $49/mo unlocks SPs), the
  same key works — nothing to reissue or re-integrate.

## 2. Deploy this repo to Netlify

1. In Netlify: **Add new site → Import an existing project** → pick this
   repo (`Odds-calculator-app`).
2. Build settings: **no build command**, publish directory = the repo root
   (leave defaults). `netlify.toml` wires up the functions folder.
3. **Site settings → Environment variables → Add**:
   Key `APIHORSERACING_KEY`, Value = the key from step 1.
   Scopes: All scopes (must include Functions). Same value for all contexts.
4. **Deploys → Trigger deploy** (env vars only apply after a fresh deploy).
5. If you previously set `RAPIDAPI_KEY` for the old provider, you can delete
   it — nothing reads it anymore.

## 3. Apply this patch, commit, push

```bash
git apply odds-apihorseracing-switch.patch
git add -A
git commit -m "Switch race data to Apihorseracing (free key): cards, race detail, settlement"
git push origin main
```

## 4. Open the Netlify URL — not file://

Netlify Functions only run on the deployed site. Opening `index.html` from
your computer shows the **demo card** (expected — there is no function to
call from `file://`).

## Phase 2-lite: settlement (free)

The History section has a **Settle Bets** control: pick a date (defaults to
today) and it settles unsettled bets placed on that date against the real
finishing positions from the same provider that feeds Today's Card.

How it works:

- Loads the user's bets, keeps only unsettled bets placed on the chosen
  date, and groups them by track + race number so each race is fetched once.
- Fetches that date's results, derives race numbers from time order within
  each meeting (same derivation as Today's Card), then fetches each bet
  race's `/result` (placed + unplaced lists).
- Win settles on 1st, Place on 1st–2nd, Show on 1st–3rd. A hit writes
  `outcome: "win"` + the estimated payout as `winnings`; a miss writes
  `outcome: "lose"` + `winnings: 0`. Either way the bet is marked
  `settled: true` with `settledPosition` and `settledAtMs`.
- The Dashboard reads the same bet records, so settled results flow into
  its totals automatically.

Honest limits:

- **Payouts stay estimated** — computed from the odds entered at bet time.
  Real starting prices need the Live plan ($49/mo). The free key withholds
  `sp` / `sp_decimal` with an explicit note naming Live.
- **Exotic bets are not auto-settled** — exacta, trifecta, superfecta, and
  pick N need more than one horse's position. They are skipped with a note.
- **Race numbers are derived** from time order within each meeting, same as
  Today's Card. If the provider ever reorders a card, a bet could match the
  wrong race — the settle report names the matched race so the user can spot
  it.
- **Horse names match loosely** (one normalized name equal to or starting
  with the other) so "Risk Tolerance" matches "Risk Tolerance (IRE)". A
  name that matches nothing is skipped, never guessed.
- **A horse in the `unplaced` list settles as a loss** (it ran or did not
  finish, either way it did not place; a casualty reason like "Fell" is
  noted). A horse absent from both lists is skipped.
- **A race with no result yet is skipped** — it has not settled in the feed.

## Dashboard: Race Detail + Past Winners

The dashboard (`dashboard.html`) shows a **Race Detail** panel for the last
race opened on Today's Card — every field the provider supplies: track,
race number, post time, distance, age condition, status, and the full
runners table (horse, jockey, trainer, age, weight, form, odds, SP, finish,
beaten distance). On the free plan, odds/SP come back withheld and beaten
distance comes back null for US races, so those columns show "—" for live
races. Track condition is NOT shown — `going`/`weather` come back null for
US tracks even on settled races (surface IS populated per race).

**Past Winners** is built locally, not from the provider (no endpoint for
all-time past winners of a race exists). **Save This Race's Result** fetches
the displayed race's detail and stores the winner (position 1) in the
browser's localStorage. History starts empty and grows as results are saved
after race days. It is per-browser storage, not shared across devices.

## What the API returns (for future work)

- `GET /racecards/{date}` → meetings: `meeting_id, course, country,
  date, going, surface, races[]`. Each race: `race_id, time, name,
  distance, age, surface, going, result_available, runners` (a COUNT).
  Race numbers are derived from time order within each meeting.
- `GET /races/{race_id}` → one race with conditions + `runners[]`:
  `cloth, draw, horse, age, weight` (stones-pounds, e.g. "8-11" — the app
  converts to pounds), `official_rating, form, owner, trainer, jockey,
  favourite, market_position, position` (int when settled, else null),
  `beaten_distance, casualty, run_status, sp, sp_decimal` (withheld on
  free).
- `GET /results/{date}` → settled races for a date, grouped into meetings,
  same shape as the card, filtered to races with a published result.
- `GET /races/{race_id}/result` → `{ result: [...] }` (placed runners
  with positions) + `{ unplaced: [...] }` (ran but unplaced, or did not
  finish — `casualty` carries the reason: PulledUp, Fell, UnseatedRider,
  BroughtDown, RefusedToRace, RanOut). Settlement reads this endpoint.

## Honest limits (teach these, don't hide them)

- US racing is pari-mutuel: the odds shown are a snapshot, and the final
  payout depends on the closing pool. The calculator's number is an
  **estimate** until the race is official.
- The free key withholds starting prices (`sp`, `sp_decimal`, `price_path`)
  — they come back null with a `withheld` note naming the Live plan. The
  app shows "—" and leaves the calculator odds blank for manual entry.
  Enter morning-line odds by hand, or upgrade to Live ($49/mo) for real SPs.
- `going`, `weather`, `winning_time`, and `beaten_distance` are nullable
  even on settled US races — do not present them as guaranteed fields.
  Surface is populated per race (DIRT/TURF).
- Bookmaker odds do not exist in this dataset and never will, per the
  provider's own coverage note. There is no "market maker" feed for
  pari-mutuel racing — the pool itself is the market.
- This API is a third-party data source, not Equibase-official data.
  Fine for a prototype/education tool — verify licensing before any
  commercial use.
