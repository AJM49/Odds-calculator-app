// Dashboard "Race Detail" panel + "Past Winners" history.
//
// Reads the last race the user opened on Today's Card (saved to
// localStorage by racecard.js) and renders every field the provider
// supplies: track, race, post time, distance, age, status, and the full
// runners table (horse, jockey, trainer, age, weight, form, odds, SP,
// finish, beaten distance). On the free data plan, odds/SP come back
// withheld and beaten distance comes back null, so those columns show
// "—" for live races; demo races still carry sample values.
//
// Past Winners: the provider has NO endpoint for all-time past winners of
// a race, so this history is built locally. "Save This Race's Result"
// fetches the displayed race's detail through the same Netlify proxy and
// stores the winner (position "1"). History starts empty and grows as
// results are saved after race days. Stored in localStorage only.

(function () {
  "use strict";

  const LAST_RACE_KEY = "racecard_last_race";
  const HISTORY_KEY = "racecard_results_history";
  const HISTORY_MAX = 500;

  const U = (typeof window !== "undefined" && window.RacecardUtils) || {};

  function toText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function orDash(value) {
    const s = toText(value);
    return s === "" ? "—" : s;
  }

  // Local fallback if racecard.js failed to load. Saved races carry a
  // formatted `offtime` ("5:10 PM"); older entries may only have a date
  // string with an embedded time.
  function parseTimeFallback(dateStr) {
    const raw = toText(dateStr);
    if (!raw) return "";
    const m = raw.match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    let hour = Number(m[1]);
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const tz = raw.match(/\(([^)]+)\)/);
    return `${hour}:${m[2]} ${suffix}${tz ? ` (${tz[1]})` : ""}`;
  }

  function raceTime(race) {
    if (toText(race?.offtime)) return toText(race.offtime);
    if (typeof U.formatPostTime === "function" && toText(race?.time)) return U.formatPostTime(race.time);
    return parseTimeFallback(race?.date);
  }

  function readJSON(key) {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function readHistory() {
    const data = readJSON(HISTORY_KEY);
    return Array.isArray(data) ? data : [];
  }

  function statusText(race) {
    if (!race) return "";
    if (race.canceled) return "Canceled";
    if (race.finished) return "Final";
    return "Scheduled";
  }

  function renderRaceDetail(saved) {
    const panel = document.getElementById("raceDetailPanel");
    const status = document.getElementById("raceDetailStatus");
    const saveBtn = document.getElementById("saveResultBtn");
    if (!panel) return;

    if (!saved || !saved.race) {
      panel.innerHTML = "";
      if (status) status.textContent = "No race selected yet. Open a race on Today's Card (calculator page) and its full detail appears here.";
      if (saveBtn) saveBtn.disabled = true;
      renderPastWinners(null);
      return;
    }

    const race = saved.race;
    const horses = Array.isArray(saved.horses) ? saved.horses : [];
    const isDemo = saved.mode === "demo";

    if (status) {
      status.textContent = isDemo
        ? "DEMO RACE — sample data with fictional names."
        : `Data: ${saved.mode === "cache" ? "Cached" : "Live"} · Saved ${saved.savedAt ? new Date(saved.savedAt).toLocaleString() : ""}`;
    }
    if (saveBtn) saveBtn.disabled = isDemo;

    const facts = [
      ["Track", race.course],
      ["Race", race.raceNo ? `Race ${race.raceNo}` : "—"],
      ["Post time", raceTime(race)],
      ["Distance", race.distance],
      ["Age", race.age],
      ["Status", statusText(race)],
      ["Date", race.date],
    ];
    const factsHtml = facts
      .map(([label, value]) => `<div class="race-fact"><span>${label}</span><strong>${orDash(value)}</strong></div>`)
      .join("");

    let tableHtml = "";
    if (!horses.length) {
      tableHtml = `<p class="racecard-empty">No runners listed for this race.</p>`;
    } else {
      const rows = horses.map((h) => {
        const cells = [
          h.number, h.horse, h.jockey, h.trainer, h.age, h.weight, h.form,
          h.odds, h.sp, h.position, h.beaten,
        ].map((v) => `<td>${orDash(v)}</td>`).join("");
        const cls = h.scratched ? ` class="scratched"` : "";
        return `<tr${cls}>${cells}</tr>`;
      }).join("");
      tableHtml = `<div class="table-wrap"><table class="race-detail-table"><thead><tr><th>#</th><th>Horse</th><th>Jockey</th><th>Trainer</th><th>Age</th><th>Wt</th><th>Form</th><th>Odds</th><th>SP</th><th>Fin</th><th>Beaten</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    panel.innerHTML = `<div class="race-facts">${factsHtml}</div>${tableHtml}`;
    renderPastWinners(race);
  }

  function renderPastWinners(race) {
    const list = document.getElementById("pastWinnersList");
    if (!list) return;
    const history = readHistory();
    const matches = race
      ? history.filter((e) => e.course === race.course && String(e.raceNo) === String(race.raceNo))
      : [];
    // Newest first.
    matches.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if (!race) {
      list.innerHTML = `<p class="racecard-empty">Pick a race first — past winners show for the race in the detail panel.</p>`;
      return;
    }
    if (!matches.length) {
      list.innerHTML = `<p class="racecard-empty">No past winners recorded for ${orDash(race.course)}${race.raceNo ? ` Race ${race.raceNo}` : ""} yet. Save results after race days and they build up here.</p>`;
      return;
    }
    list.innerHTML = `<ul class="past-winners">${matches.map((e) =>
      `<li><strong>${orDash(e.date)}</strong> — ${orDash(e.winner)} <span>(${orDash(e.jockey)} / ${orDash(e.trainer)})</span>${e.sp ? ` · SP ${e.sp}` : ""}</li>`
    ).join("")}</ul>`;
  }

  async function saveResult() {
    const status = document.getElementById("raceDetailStatus");
    const saved = readJSON(LAST_RACE_KEY);
    const race = saved?.race;
    if (!race || !race.id) {
      if (status) status.textContent = "No race selected to save.";
      return;
    }
    if (saved.mode === "demo") {
      if (status) status.textContent = "Demo races can't be saved.";
      return;
    }
    if (status) status.textContent = "Fetching this race's result…";
    try {
      const res = await fetch(`/.netlify/functions/apihorseracing?action=race&id=${encodeURIComponent(String(race.id))}`, { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) throw new Error((body && body.message) || `Result request failed (${res.status}).`);
      const detail = typeof U.normalizeRaceDetail === "function" ? U.normalizeRaceDetail(body.data) : null;
      const horses = detail?.horses || [];
      const winner = horses.find((h) => toText(h.position) === "1" && !h.scratched);
      if (!winner) {
        if (status) status.textContent = "No result yet — this race hasn't finished (no winner recorded).";
        return;
      }
      const history = readHistory();
      const key = `${toText(race.date)}|${String(race.id)}`;
      if (history.some((e) => e.key === key)) {
        if (status) status.textContent = `Result already saved: ${winner.horse} won ${orDash(race.course)}${race.raceNo ? ` Race ${race.raceNo}` : ""}.`;
        renderPastWinners(race);
        return;
      }
      history.push({
        key,
        date: toText(race.date),
        raceId: String(race.id),
        course: race.course || "",
        raceNo: race.raceNo ?? null,
        winner: winner.horse || "",
        jockey: winner.jockey || "",
        trainer: winner.trainer || "",
        sp: winner.sp || "",
      });
      writeJSON(HISTORY_KEY, history.slice(-HISTORY_MAX));
      if (status) status.textContent = `Saved: ${winner.horse} won ${orDash(race.course)}${race.raceNo ? ` Race ${race.raceNo}` : ""}.`;
      renderPastWinners(race);
    } catch (err) {
      console.error(err);
      if (status) status.textContent = `Could not save the result: ${err.message}`;
    }
  }

  function init() {
    if (!document.getElementById("raceDetailPanel")) return; // Not on the dashboard page.
    const saveBtn = document.getElementById("saveResultBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveResult);
    renderRaceDetail(readJSON(LAST_RACE_KEY));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
