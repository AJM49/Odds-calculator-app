// Phase 2-lite (free) settlement helpers — pure functions, no DOM, no fetch.
//
// A paper bet settles against the real finishing positions from the same
// provider that feeds Today's Card. Payouts stay ESTIMATED: they are computed
// from the odds the user entered, because real starting prices need a paid
// plan. Only Win / Place / Show auto-settle — exotic bets (exacta, trifecta,
// superfecta, pick N) need more than one horse's position, so they are left
// for manual settlement.
//
// Matching notes (honest limits):
// - Race numbers are DERIVED from time order within a meeting,
//   exactly as Today's Card does. If the provider ever reorders a card, a
//   bet could match the wrong race — the settle report shows the matched
//   race so the user can spot it.
// - Horse names match when one normalized name equals or starts with the
//   other, so "Risk Tolerance" matches "Risk Tolerance (IRE)". A name that
//   matches nothing is skipped, never guessed.
// - A horse in the result's `unplaced` list ran (or did not finish) but
//   did not place, so it settles as a loss. A horse absent from both the
//   placed and unplaced lists is skipped, never guessed.
// - Bets settle only if they were placed on the chosen results date, so an
//   old unsettled bet cannot be matched against the wrong day's card.

(function () {
  "use strict";

  // Lowercase, strip everything but letters and digits: "Risk Tolerance (IRE)"
  // -> "risktoleranceire". Prefix matching in namesMatch handles the suffix.
  function normalizeName(value) {
    if (value === null || value === undefined) return "";
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function namesMatch(a, b) {
    const x = normalizeName(a);
    const y = normalizeName(b);
    if (!x || !y) return false;
    return x === y || x.startsWith(y) || y.startsWith(x);
  }

  // "1" -> 1, "1st" -> 1, "" / null / "SCR" -> null.
  function parsePosition(value) {
    if (value === null || value === undefined) return null;
    const digits = String(value).replace(/[^0-9]/g, "");
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Index a results response (array of meetings) by "course|raceNo" so a
  // bet (track + race number) maps straight to its race. Race numbers are
  // derived: races are in time order within a meeting, numbered 1..N —
  // the same derivation Today's Card uses, so card and settlement agree.
  // Returns a Map: key -> { raceId, course, raceNo, time }.
  function indexResults(meetings) {
    const out = new Map();
    (Array.isArray(meetings) ? meetings : []).forEach((meeting) => {
      if (!meeting || typeof meeting !== "object") return;
      const course = meeting.course;
      const races = Array.isArray(meeting.races) ? meeting.races : [];
      races
        .filter((r) => r && typeof r === "object")
        .slice()
        .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
        .forEach((race, idx) => {
          const raceNo = idx + 1;
          out.set(`${normalizeName(course)}|${raceNo}`, {
            raceId: String(race.race_id || ""),
            course: String(course || ""),
            raceNo,
            time: String(race.time || ""),
          });
        });
    });
    return out;
  }

  // Finishing positions that cash each simple bet type. Returns null for
  // exotic types (cannot settle from one horse's position).
  const SETTLE_PLACES = { win: 1, place: 2, show: 3 };
  function settlePlacesFor(betType) {
    return Object.prototype.hasOwnProperty.call(SETTLE_PLACES, betType)
      ? SETTLE_PLACES[betType]
      : null;
  }

  // "win" if the horse finished within the bet type's places, else "lose".
  function settleOutcome(betType, position) {
    const places = settlePlacesFor(betType);
    if (places === null) return null;
    if (position === null) return null;
    return position <= places ? "win" : "lose";
  }

  // Settle one bet against a /result response ({ result: [...],
  // unplaced: [...] }). Returns { outcome, position, note }:
  // - horse in result[] with a real position -> win/lose by bet type.
  // - horse in unplaced[] -> lose (it ran or did not finish, either way it
  //   did not place; a casualty reason is noted when one exists).
  // - horse in neither -> outcome null (not in the result: scratched,
  //   name mismatch, or position unpublished) — never guessed.
  function settleFromResult(betType, resultData, horseName) {
    if (settlePlacesFor(betType) === null) {
      return { outcome: null, position: null, note: `${betType} bets need manual settlement` };
    }
    const placed = Array.isArray(resultData?.result) ? resultData.result : [];
    const unplaced = Array.isArray(resultData?.unplaced) ? resultData.unplaced : [];
    const hit = placed.find((p) => p && namesMatch(horseName, p.horse));
    if (hit) {
      const pos = parsePosition(hit.position);
      if (pos === null) {
        return { outcome: null, position: null, note: "placed but position not published" };
      }
      return {
        outcome: settleOutcome(betType, pos),
        position: pos,
        note: `finished ${pos}`,
      };
    }
    const up = unplaced.find((p) => p && namesMatch(horseName, p.horse));
    if (up) {
      const casualty = up.casualty === null || up.casualty === undefined ? "" : String(up.casualty).trim();
      return {
        outcome: "lose",
        position: null,
        note: casualty ? `did not finish: ${casualty}` : "ran unplaced",
      };
    }
    return { outcome: null, position: null, note: "horse not found in the result" };
  }

  // Local YYYY-MM-DD for a millisecond timestamp (bets settle against the
  // date they were placed on).
  function localDateString(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const helpers = {
    normalizeName,
    namesMatch,
    parsePosition,
    indexResults,
    settlePlacesFor,
    settleOutcome,
    settleFromResult,
    localDateString,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  }
  if (typeof window !== "undefined") {
    window.SettleUtils = helpers;
  }
})();
