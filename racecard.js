// Phase 1 — "Today's Card" (paper betting).
//
// Data comes from the Netlify Function proxy (/.netlify/functions/racecards),
// which forwards to the RapidAPI "Horse Racing USA" API and caches the day's
// cards so the free tier (50 req/day) lasts. If the function is not
// configured (no RAPIDAPI_KEY) or unreachable, the section falls back to a
// clearly labeled DEMO card with fictional names — never presented as real.
//
// Upstream shapes (verified against the provider's client):
//   GET /racecards?date=YYYY-MM-DD -> [{id_race, course, date, distance,
//       age, finished, canceled, offtime}]
//   GET /race/{id_race} -> {id_race, course, ..., horses: [{horse, id_horse,
//       jockey, trainer, age, weight, number, non_runner, form, position,
//       distance_beaten, odds, poolData}]}
// The API exposes no explicit race number, so Race N is the race's order
// on its course's card (sorted by id_race, which follows card order).

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

  function isScratched(nonRunner) {
    if (nonRunner === true || nonRunner === 1) return true;
    const raw = toText(nonRunner).toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "y" || raw === "scr";
  }

  // Normalize a racecards response into per-course races with derived race
  // numbers (1..N in card order per course). Returns [] for anything
  // unexpected instead of throwing.
  function normalizeRacecards(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const byCourse = new Map();
    list.forEach((race) => {
      if (!race || typeof race !== "object") return;
      const course = toText(race.course) || "Unknown track";
      if (!byCourse.has(course)) byCourse.set(course, []);
      byCourse.get(course).push(race);
    });
    const out = [];
    byCourse.forEach((races, course) => {
      const sorted = races
        .slice()
        .sort((a, b) => (Number(a.id_race) || 0) - (Number(b.id_race) || 0));
      sorted.forEach((race, idx) => {
        out.push({
          id: race.id_race,
          course,
          date: toText(race.date),
          distance: toText(race.distance),
          age: toText(race.age),
          finished: race.finished === true || toText(race.finished) === "1",
          canceled: race.canceled === true || toText(race.canceled) === "1",
          offtime: toText(race.offtime),
          raceNo: idx + 1,
        });
      });
    });
    return out;
  }

  // Normalize a /race/{id} response into { race, horses: [...] }.
  function normalizeRaceDetail(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const horsesRaw = Array.isArray(raw.horses) ? raw.horses : [];
    const horses = horsesRaw
      .filter((h) => h && typeof h === "object")
      .map((h) => ({
        number: toText(h.number),
        horse: toText(h.horse),
        jockey: toText(h.jockey),
        trainer: toText(h.trainer),
        age: toText(h.age),
        weight: toText(h.weight),
        form: toText(h.form),
        odds: toText(h.odds),
        position: toText(h.position),
        scratched: isScratched(h.non_runner),
      }))
      .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));
    return {
      race: {
        id: raw.id_race,
        course: toText(raw.course),
        date: toText(raw.date),
        distance: toText(raw.distance),
        age: toText(raw.age),
        finished: raw.finished === true || toText(raw.finished) === "1",
        canceled: raw.canceled === true || toText(raw.canceled) === "1",
        offtime: toText(raw.offtime),
      },
      horses,
    };
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
    const res = await fetch(`/.netlify/functions/racecards?${query.toString()}`, {
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
    title.textContent = `${detail.race.course || ""}${raceNo ? ` — Race ${raceNo}` : ""}${detail.race.distance ? ` · ${detail.race.distance}` : ""}`;
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
        h.horse || "—",
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
        (decimal === null ? " — odds not in a recognized format, enter them by hand." : ". Enter your bet amount and hit Calculate."),
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
    setStatus("Demo card — sample data. Add your RapidAPI key to see today's real cards.");
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
      isScratched,
      normalizeRacecards,
      normalizeRaceDetail,
      DEMO_RACES,
      DEMO_DETAILS,
    };
  }
})();
