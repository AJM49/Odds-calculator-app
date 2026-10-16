// Phase 1 — "Today's Card" (paper betting).
//
// Data comes from the Netlify Function proxy
// (/.netlify/functions/apihorseracing), which forwards to Apihorseracing
// and caches the day's cards so the free tier (50 lookups/day) lasts. If
// the function is not configured (no APIHORSERACING_KEY) or unreachable,
// the section falls back to a clearly labeled DEMO card with fictional
// names — never presented as real.
//
// Upstream shapes (verified live 2026-10-16 against the free key):
//   GET /racecards/{date} -> { data: [ { meeting_id, course, country,
//       date, going, surface, races: [ { race_id, time, name, distance,
//       age, surface, going, result_available, runners } ] } ] }
//       `runners` on a card race is a COUNT, not a list. Race numbers are
//       derived: races are in time order within a meeting, numbered 1..N.
//   GET /races/{race_id} -> { data: { race_id, course, date, time, name,
//       distance, age, surface, going, result_available, runners: [
//       { cloth, draw, horse, age, weight, official_rating, form, owner,
//         trainer, jockey, favourite, market_position, position,
//         beaten_distance, casualty, run_status, sp, sp_decimal, ... } ] } }
//       `weight` is stones-pounds ("8-11"), converted to pounds for the
//       card. `sp` / `sp_decimal` are WITHHELD (null) on the free key —
//       odds always show "—" and the calculator odds stay blank for
//       manual entry. `position` is an int when settled, else null.
//       `going`, `weather`, `winning_time`, `beaten_distance` are null
//       for US races even when settled; `surface` IS populated.

(function () {
  "use strict";

  /* ---------------- Pure helpers (also exported for smoke tests) ---------------- */

  function toText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  // Fractional "5/2" -> 3.5, decimal "3.50" -> 3.5, American "+150" -> 2.5,
  // "-200" -> 1.5, "EVEN" -> 2. Anything else -> null (leave odds blank and
  // let the user type it). The API's odds string format is not documented,
  // so this is intentionally defensive.
  function oddsToDecimal(oddsStr) {
    const raw = toText(oddsStr).toUpperCase().replace(",", "");
    if (!raw) return null;
    if (raw === "EVEN" || raw === "EVENS" || raw === "EVS") return 2;
    if (raw.includes("/")) {
      const parts = raw.split("/");
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0 || num < 0) return null;
      return 1 + num / den;
    }
    if (/^[+-]\d+$/.test(raw)) {
      const american = Number(raw);
      if (!Number.isFinite(american) || Math.abs(american) < 100) return null;
      return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
    }
    const decimal = Number(raw);
    if (!Number.isFinite(decimal) || decimal <= 1) return null;
    return decimal;
  }

  // "17:10" -> "5:10 PM". The feed gives scheduled post time as 24-hour
  // "HH:MM" (course-local, no timezone). Returns "" when unparseable.
  function formatPostTime(timeValue) {
    const raw = toText(timeValue);
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return "";
    let hour = Number(m[1]);
    const minute = m[2];
    if (!Number.isFinite(hour) || hour > 23) return "";
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${suffix}`;
  }

  // "8-11" (stones-pounds) -> "123" (pounds). Plain pounds ("126") pass
  // through. Anything else passes through untouched.
  function displayWeight(weightValue) {
    const raw = toText(weightValue);
    const m = raw.match(/^(\d+)-(\d{1,2})$/);
    if (!m) return raw;
    return String(Number(m[1]) * 14 + Number(m[2]));
  }

  // The live feed returns age 0 for runners whose age is unknown — show
  // blank ("—") rather than a bogus 0.
  function cleanAge(ageValue) {
    if (ageValue === null || ageValue === undefined) return "";
    if (typeof ageValue === "object") return "";
    const s = String(ageValue).trim();
    if (s === "" || s === "0") return "";
    return s;
  }

  // Normalize a racecards response (array of meetings) into per-course
  // races with derived race numbers (1..N in time order per meeting).
  // Returns [] for anything unexpected instead of throwing.
  function normalizeRacecards(raw) {
    const meetings = Array.isArray(raw) ? raw : [];
    const out = [];
    meetings.forEach((meeting) => {
      if (!meeting || typeof meeting !== "object") return;
      const course = toText(meeting.course) || "Unknown track";
      const date = toText(meeting.date);
      const races = Array.isArray(meeting.races) ? meeting.races : [];
      const sorted = races
        .filter((r) => r && typeof r === "object")
        .slice()
        .sort((a, b) => toText(a.time).localeCompare(toText(b.time)));
      sorted.forEach((race, idx) => {
        out.push({
          id: toText(race.race_id),
          course,
          date,
          name: toText(race.name),
          distance: toText(race.distance),
          age: toText(race.age),
          surface: toText(race.surface) || toText(meeting.surface),
          going: toText(race.going) || toText(meeting.going),
          finished: race.result_available === true,
          canceled: false,
          time: toText(race.time),
          offtime: formatPostTime(race.time),
          runners: Number(race.runners) || 0,
          raceNo: idx + 1,
        });
      });
    });
    return out;
  }

  // Normalize a /races/{id} response into { race, horses: [...] }.
  // Odds/SP are withheld (null) on the free key, so they normalize to "" —
  // the UI shows "—" and the calculator odds stay blank for manual entry.
  // A settled horse carries an int position; an unsettled one carries null.
  // `casualty` (e.g. "Fell") shows in the Fin column when there is no
  // position. There is no scratched flag in this feed — withdrawn horses
  // simply leave the field — so scratched is always false here.
  function normalizeRaceDetail(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const runnersRaw = Array.isArray(raw.runners) ? raw.runners : [];
    const horses = runnersRaw
      .filter((h) => h && typeof h === "object")
      .map((h) => {
        const pos = Number(h.position);
        return {
          number: toText(h.cloth),
          horse: toText(h.horse),
          jockey: toText(h.jockey),
          trainer: toText(h.trainer),
          age: cleanAge(h.age),
          weight: displayWeight(h.weight),
          form: toText(h.form),
          draw: toText(h.draw),
          rating: toText(h.official_rating),
          favourite: h.favourite === true,
          marketPosition: toText(h.market_position),
          odds: "",
          sp: "",
          beaten: toText(h.beaten_distance),
          position: Number.isFinite(pos) && pos > 0 ? String(pos) : toText(h.casualty),
          scratched: false,
        };
      })
      .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));
    return {
      race: {
        id: toText(raw.race_id),
        course: toText(raw.course),
        date: toText(raw.date),
        name: toText(raw.name),
        distance: toText(raw.distance),
        age: toText(raw.age),
        surface: toText(raw.surface),
        going: toText(raw.going),
        finished: raw.result_available === true,
        canceled: false,
        time: toText(raw.time),
        offtime: formatPostTime(raw.time),
      },
      horses,
    };
  }

  // Post time for a saved race: `offtime` is already formatted ("5:10 PM")
  // by the normalizers. Kept as a helper so the dashboard panel and any
  // older saved entries resolve the same way.
  function raceTime(race) {
    if (!race) return "";
    if (toText(race.offtime)) return toText(race.offtime);
    return formatPostTime(race.time);
  }

  // Remember the last race the user opened, so the dashboard's Race Detail
  // panel can render it. Best-effort: failures (private mode, quota) just
  // leave the panel empty.
  const LAST_RACE_KEY = "racecard_last_race";
  function saveLastRace(race, horses) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(LAST_RACE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        mode: state.mode,
        race: {
          id: race?.id ?? null,
          course: race?.course || "",
          date: race?.date || "",
          distance: race?.distance || "",
          age: race?.age || "",
          offtime: race?.offtime || "",
          finished: !!race?.finished,
          canceled: !!race?.canceled,
          raceNo: race?.raceNo ?? null,
        },
        horses: Array.isArray(horses) ? horses : [],
      }));
    } catch (_) {
      // Ignore — dashboard panel just stays empty.
    }
  }

  /* ---------------- Demo card (fictional names, clearly labeled) ---------------- */

  const DEMO_RACES = [
    { id: "demo-1", course: "Demo Downs", date: "", distance: "6f", age: "3yo+", finished: false, canceled: false, offtime: "1:30 PM", raceNo: 1 },
    { id: "demo-2", course: "Demo Downs", date: "", distance: "1m", age: "3yo+", finished: true, canceled: false, offtime: "2:05 PM", raceNo: 2 },
    { id: "demo-3", course: "Demo Park", date: "", distance: "5f", age: "2yo", finished: false, canceled: false, offtime: "1:45 PM", raceNo: 1 },
  ];

  const DEMO_DETAILS = {
    "demo-1": {
      race: DEMO_RACES[0],
      horses: [
        { number: "1", horse: "Demo Star", jockey: "D. Emo", trainer: "P. Ractice", age: "4", weight: "122", form: "1-2-1", odds: "2/1", position: "", scratched: false },
        { number: "2", horse: "Paper Trail", jockey: "S. Ample", trainer: "T. Esting", age: "5", weight: "120", form: "3-1-4", odds: "5/2", position: "", scratched: false },
        { number: "3", horse: "Practice Run", jockey: "F. Iction", trainer: "M. Ockup", age: "3", weight: "118", form: "2-2-3", odds: "4/1", position: "", scratched: false },
        { number: "4", horse: "Dry Run", jockey: "N. Otareal", trainer: "D. Emos", age: "6", weight: "121", form: "0-0-5", odds: "12/1", position: "", scratched: true },
      ],
    },
    "demo-2": {
      race: DEMO_RACES[1],
      horses: [
        { number: "1", horse: "Sample Pride", jockey: "D. Emo", trainer: "P. Ractice", age: "4", weight: "122", form: "1-1-1", odds: "6/5", position: "1", scratched: false },
        { number: "2", horse: "Test Pattern", jockey: "S. Ample", trainer: "T. Esting", age: "5", weight: "120", form: "2-3-1", odds: "3/1", position: "2", scratched: false },
        { number: "3", horse: "Mockingbird Lane", jockey: "F. Iction", trainer: "M. Ockup", age: "3", weight: "118", form: "4-2-2", odds: "9/2", position: "3", scratched: false },
      ],
    },
    "demo-3": {
      race: DEMO_RACES[2],
      horses: [
        { number: "1", horse: "Rehearsal", jockey: "N. Otareal", trainer: "D. Emos", age: "2", weight: "119", form: "1", odds: "7/2", position: "", scratched: false },
        { number: "2", horse: "First Draft", jockey: "D. Emo", trainer: "P. Ractice", age: "2", weight: "117", form: "2", odds: "5/2", position: "", scratched: false },
        { number: "3", horse: "Stand In", jockey: "S. Ample", trainer: "T. Esting", age: "2", weight: "116", form: "3", odds: "6/1", position: "", scratched: false },
      ],
    },
  };

  /* ---------------- Data layer ---------------- */

  async function fetchFromProxy(action, params) {
    const query = new URLSearchParams({ action, ...params });
    const res = await fetch(`/.netlify/functions/apihorseracing?${query.toString()}`, {
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      const err = new Error((body && body.message) || `Race data request failed (${res.status}).`);
      err.code = body && body.error;
      throw err;
    }
    return body; // { source: "live"|"cache", data }
  }

  /* ---------------- UI ---------------- */

  const ui = {};
  let state = {
    mode: "live", // "live" | "cache" | "demo"
    date: "",
    races: [],
    track: "all",
    selectedRaceId: null,
    detail: null,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(text, isError) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.toggle("racecard-error", !!isError);
  }

  function setDemoBanner(show) {
    if (ui.demoBanner) ui.demoBanner.style.display = show ? "block" : "none";
  }

  function renderTrackOptions() {
    if (!ui.track) return;
    const courses = [...new Set(state.races.map((r) => r.course))].sort();
    ui.track.innerHTML = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All tracks";
    ui.track.appendChild(all);
    courses.forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      ui.track.appendChild(opt);
    });
    ui.track.value = state.track;
  }

  function visibleRaces() {
    return state.races.filter((r) => state.track === "all" || r.course === state.track);
  }

  function raceLabel(race) {
    let label = `R${race.raceNo}`;
    if (race.distance) label += ` · ${race.distance}`;
    if (race.age) label += ` · ${race.age}`;
    if (race.offtime) label += ` · ${race.offtime}`;
    if (race.canceled) label += " · Canceled";
    else if (race.finished) label += " · Final";
    return label;
  }

  function renderRaceList() {
    if (!ui.races) return;
    ui.races.innerHTML = "";
    const races = visibleRaces();
    if (!races.length) {
      const empty = document.createElement("p");
      empty.className = "racecard-empty";
      empty.textContent = "No races on this card.";
      ui.races.appendChild(empty);
      return;
    }
    let currentCourse = null;
    races.forEach((race) => {
      if (race.course !== currentCourse) {
        currentCourse = race.course;
        const heading = document.createElement("div");
        heading.className = "racecard-course";
        heading.textContent = currentCourse;
        ui.races.appendChild(heading);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "racecard-race-btn" + (String(race.id) === String(state.selectedRaceId) ? " selected" : "");
      btn.textContent = raceLabel(race);
      btn.disabled = race.canceled;
      btn.addEventListener("click", () => selectRace(race));
      ui.races.appendChild(btn);
    });
  }

  function renderRunners() {
    if (!ui.runners) return;
    ui.runners.innerHTML = "";
    if (!state.detail) {
      const hint = document.createElement("p");
      hint.className = "racecard-empty";
      hint.textContent = "Pick a race to see its runners.";
      ui.runners.appendChild(hint);
      return;
    }
    const detail = state.detail;
    const title = document.createElement("h3");
    title.className = "racecard-race-title";
    const raceNo = state.races.find((r) => String(r.id) === String(detail.race.id))?.raceNo;
    title.textContent = `${detail.race.course || ""}${raceNo ? ` — Race ${raceNo}` : ""}${detail.race.name ? ` · ${detail.race.name}` : ""}${detail.race.distance ? ` · ${detail.race.distance}` : ""}`;
    ui.runners.appendChild(title);

    if (!detail.horses.length) {
      const empty = document.createElement("p");
      empty.className = "racecard-empty";
      empty.textContent = "No runners listed for this race.";
      ui.runners.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "racecard-table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>#</th><th>Horse</th><th>Jockey</th><th>Trainer</th><th>Age</th><th>Wt</th><th>Form</th><th>Odds</th><th>Fin</th><th></th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    detail.horses.forEach((h) => {
      const tr = document.createElement("tr");
      if (h.scratched) tr.classList.add("scratched");
      const cells = [
        h.number || "—",
        h.favourite ? `★ ${h.horse || "—"}` : h.horse || "—",
        h.jockey || "—",
        h.trainer || "—",
        h.age || "—",
        h.weight || "—",
        h.form || "—",
        h.odds || "—",
        h.position || "—",
      ];
      cells.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      const actionTd = document.createElement("td");
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "racecard-use-btn";
      useBtn.textContent = h.scratched ? "SCR" : "Use this horse";
      useBtn.disabled = h.scratched;
      useBtn.addEventListener("click", () => useHorse(detail.race, h));
      actionTd.appendChild(useBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    ui.runners.appendChild(table);
  }

  function useHorse(race, horse) {
    const trackInput = el("trackName");
    const horseInput = el("horseName");
    const raceInput = el("raceNumber");
    const oddsInput = el("oddsInput");
    if (trackInput) trackInput.value = race.course || "";
    if (horseInput) horseInput.value = horse.horse || "";
    const raceNo = state.races.find((r) => String(r.id) === String(race.id))?.raceNo;
    if (raceInput && raceNo) raceInput.value = String(raceNo);
    const decimal = oddsToDecimal(horse.odds);
    if (oddsInput) {
      if (decimal !== null) oddsInput.value = decimal.toFixed(2);
      else oddsInput.value = "";
    }
    const form = el("bettingForm");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus(
      `Loaded into the calculator: ${horse.horse || "runner"} @ ${race.course || ""}${raceNo ? `, Race ${raceNo}` : ""}` +
        (decimal === null ? " — starting prices are withheld on the free data plan, enter morning-line odds by hand." : ". Enter your bet amount and hit Calculate."),
      false
    );
  }

  async function selectRace(race) {
    state.selectedRaceId = race.id;
    renderRaceList();
    if (ui.runners) {
      ui.runners.innerHTML = "";
      const loading = document.createElement("p");
      loading.className = "racecard-empty";
      loading.textContent = "Loading runners…";
      ui.runners.appendChild(loading);
    }
    if (state.mode === "demo") {
      state.detail = DEMO_DETAILS[String(race.id)] || { race, horses: [] };
      saveLastRace(state.detail.race, state.detail.horses);
      renderRunners();
      return;
    }
    try {
      const res = await fetchFromProxy("race", { id: String(race.id) });
      const detail = normalizeRaceDetail(res.data);
      if (!detail) throw new Error("Race detail came back empty.");
      // Keep the card's raceNo for the title by merging with the card race.
      detail.race = { ...race, ...detail.race, id: race.id, course: race.course };
      state.detail = detail;
      saveLastRace(detail.race, detail.horses);
      renderRunners();
    } catch (err) {
      console.error(err);
      setStatus(`Could not load runners: ${err.message}`, true);
      if (ui.runners) ui.runners.innerHTML = "";
    }
  }

  function loadDemo(date) {
    state.mode = "demo";
    state.races = DEMO_RACES.map((r) => ({ ...r, date }));
    state.selectedRaceId = null;
    state.detail = null;
    setDemoBanner(true);
    setStatus("Demo card — sample data. Add your Apihorseracing key to see today's real cards.");
    renderTrackOptions();
    renderRaceList();
    renderRunners();
  }

  async function loadCard() {
    const date = ui.date ? ui.date.value : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setStatus("Pick a valid date first.", true);
      return;
    }
    state.date = date;
    state.selectedRaceId = null;
    state.detail = null;
    setStatus("Loading today's card…");
    if (ui.loadBtn) ui.loadBtn.disabled = true;
    try {
      const res = await fetchFromProxy("racecards", { date });
      const races = normalizeRacecards(res.data);
      state.mode = res.source === "cache" ? "cache" : "live";
      state.races = races;
      state.track = "all";
      setDemoBanner(false);
      setStatus(
        races.length
          ? `${state.mode === "cache" ? "Cached" : "Live"} card for ${date} — ${races.length} race(s). Pick a race to see its runners.`
          : `No cards found for ${date}. Some tracks are dark on this date.`
      );
      renderTrackOptions();
      renderRaceList();
      renderRunners();
    } catch (err) {
      console.error(err);
      if (err.code === "not_configured") {
        loadDemo(date);
      } else {
        setStatus(`Could not load the card: ${err.message} — showing the demo card instead.`, true);
        loadDemo(date);
      }
    } finally {
      if (ui.loadBtn) ui.loadBtn.disabled = false;
    }
  }

  function init() {
    ui.date = el("racecardDate");
    ui.track = el("racecardTrack");
    ui.races = el("racecardRaces");
    ui.runners = el("racecardRunners");
    ui.status = el("racecardStatus");
    ui.loadBtn = el("racecardLoadBtn");
    ui.demoBanner = el("racecardDemoBanner");
    // Section not on this page (racecard.js only loads on index.html) — bail out.
    if (!ui.date || !ui.races || !ui.runners) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    ui.date.value = `${yyyy}-${mm}-${dd}`;

    if (ui.loadBtn) ui.loadBtn.addEventListener("click", loadCard);
    if (ui.track) {
      ui.track.addEventListener("change", () => {
        state.track = ui.track.value;
        state.selectedRaceId = null;
        state.detail = null;
        renderRaceList();
        renderRunners();
      });
    }
    loadCard();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  // Exported for the Node smoke test (no `module` in browsers).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      oddsToDecimal,
      cleanAge,
      formatPostTime,
      displayWeight,
      raceTime,
      normalizeRacecards,
      normalizeRaceDetail,
      DEMO_RACES,
      DEMO_DETAILS,
    };
  }

  // Expose helpers to dashboard-race.js (same page family, no bundler).
  if (typeof window !== "undefined") {
    window.RacecardUtils = {
      oddsToDecimal,
      cleanAge,
      formatPostTime,
      displayWeight,
      raceTime,
      normalizeRacecards,
      normalizeRaceDetail,
    };
  }
})();
