// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= CONFIG =================
const API_BASE = "https://api.example.com"; // replace with real provider

// ================= STATE =================
const state = {
  selectedTrack: null,
  selectedRace: null,
  betType: null,
  selectedHorses: [],
  stake: 0,
  odds: {}
};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  renderDemoRaces();
  await autoSettleBets();
  await loadAnalytics();
});

// ================= DEMO =================
function renderDemoRaces() {
  const section = document.querySelector(".section");
  section.innerHTML = "<h3>Races</h3>";

  ["Tampa-1", "Parx-3"].forEach(r => {
    const div = document.createElement("div");
    div.className = "race-card";
    div.innerText = r;
    div.onclick = () => selectRace(r);
    section.appendChild(div);
  });
}

// ================= SELECT =================
function selectRace(label) {
  const [track, race] = label.split("-");
  state.selectedTrack = track;
  state.selectedRace = race;

  loadOdds();
  openBuilder();
}

// ================= ODDS =================
function loadOdds() {
  state.odds = {};
  for (let i = 1; i <= 8; i++) {
    state.odds[i] = (Math.random() * 10 + 2).toFixed(2);
  }
}

// ================= BUILDER =================
function openBuilder() {
  let panel = document.getElementById("betBuilder");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "betBuilder";
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <h3>${state.selectedTrack} Race ${state.selectedRace}</h3>

    <button onclick="setBetType('win')">Win</button>

    <div id="horseGrid"></div>

    <input type="number" placeholder="Stake" oninput="setStake(this.value)" />

    <button onclick="placeBet()">Place Bet</button>
  `;

  renderHorses();
}

function renderHorses() {
  const grid = document.getElementById("horseGrid");
  grid.innerHTML = "";

  Object.keys(state.odds).forEach(n => {
    const btn = document.createElement("button");
    btn.innerText = `${n} (${state.odds[n]})`;
    btn.onclick = () => toggleHorse(Number(n), btn);
    grid.appendChild(btn);
  });
}

function toggleHorse(h, btn) {
  const i = state.selectedHorses.indexOf(h);

  if (i > -1) {
    state.selectedHorses.splice(i, 1);
    btn.style.background = "#fff";
  } else {
    state.selectedHorses.push(h);
    btn.style.background = "#4caf50";
    btn.style.color = "#fff";
  }
}

// ================= STATE =================
function setBetType(t) {
  state.betType = t;
}

function setStake(v) {
  state.stake = parseFloat(v) || 0;
}

// ================= PLACE BET =================
async function placeBet() {
  const bet = {
    track: state.selectedTrack,
    race: state.selectedRace,
    horses: state.selectedHorses,
    stake: state.stake,
    odds: state.odds,
    result: "pending",
    payout: 0,
    createdAt: new Date().toISOString()
  };

  await addDoc(collection(db, "bets"), bet);
}

// ================= LIVE RESULTS =================
async function fetchResults(track, race) {
  try {
    const res = await fetch(`${API_BASE}/results?track=${track}&race=${race}`);
    const data = await res.json();

    // expected format: { winner: 3 }
    return data.winner;

  } catch {
    return null;
  }
}

// ================= AUTO SETTLEMENT =================
async function autoSettleBets() {
  const snap = await getDocs(collection(db, "bets"));

  for (const d of snap.docs) {
    const bet = d.data();

    if (bet.result !== "pending") continue;

    const winner = await fetchResults(bet.track, bet.race);
    if (!winner) continue;

    const isWin = bet.horses.includes(winner);

    const payout = isWin
      ? bet.stake * parseFloat(bet.odds[winner])
      : 0;

    await updateDoc(doc(db, "bets", d.id), {
      result: isWin ? "win" : "loss",
      payout: payout
    });
  }
}

// ================= ANALYTICS =================
async function loadAnalytics() {
  const snap = await getDocs(collection(db, "bets"));

  let stake = 0;
  let returns = 0;
  let perRace = {};
  let breakdown = [];

  snap.forEach(d => {
    const b = d.data();

    stake += b.stake;
    returns += b.payout;

    const key = `${b.track}-${b.race}`;
    if (!perRace[key]) {
      perRace[key] = { stake: 0, return: 0 };
    }

    perRace[key].stake += b.stake;
    perRace[key].return += b.payout;

    breakdown.push({
      race: key,
      stake: b.stake,
      payout: b.payout,
      profit: b.payout - b.stake
    });
  });

  renderRaceROI(perRace);
  renderBreakdown(breakdown);
}

// ================= ROI PER RACE =================
function renderRaceROI(data) {
  let html = "<h3>ROI by Race</h3>";

  Object.keys(data).forEach(r => {
    const s = data[r].stake;
    const ret = data[r].return;

    const roi = s ? ((ret - s) / s) * 100 : 0;

    html += `${r}: ${roi.toFixed(2)}%<br>`;
  });

  document.getElementById("performanceSection").innerHTML = html;
}

// ================= PER BET =================
function renderBreakdown(list) {
  const section = document.getElementById("betBreakdownSection");

  section.innerHTML = "<h3>Bet Breakdown</h3>";

  list.forEach(b => {
    const div = document.createElement("div");

    div.innerText = `
      ${b.race} | Stake: $${b.stake}
      | Payout: $${b.payout}
      | Profit: $${b.profit}
    `;

    section.appendChild(div);
  });
}
