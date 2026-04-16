// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔴 REPLACE WITH YOUR REAL CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
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
  odds: {},
  races: []
};

// ================= DATA PROVIDER =================
const DATA_PROVIDER = {

  async getRaces() {
    try {
      const res = await fetch(`${API_BASE}/races`);
      const data = await res.json();
      return normalizeRaces(data);
    } catch {
      return fallbackRaces();
    }
  },

  async getOdds(track, race) {
    try {
      const res = await fetch(`${API_BASE}/odds?track=${track}&race=${race}`);
      const data = await res.json();
      return normalizeOdds(data);
    } catch {
      return fallbackOdds();
    }
  }
};

// ================= NORMALIZATION =================
function normalizeRaces(data) {
  return data.races.map(r => ({
    track: r.track_name,
    race: r.race_number,
    time: r.post_time
  }));
}

function normalizeOdds(data) {
  const map = {};
  data.runners.forEach(h => {
    map[h.number] = parseFloat(h.odds);
  });
  return map;
}

// ================= FALLBACK =================
function fallbackRaces() {
  return [
    { track: "Tampa", race: 1, time: "12:20 PM" },
    { track: "Parx", race: 3, time: "1:05 PM" }
  ];
}

function fallbackOdds() {
  const odds = {};
  for (let i = 1; i <= 8; i++) {
    odds[i] = (Math.random() * 10 + 2).toFixed(2);
  }
  return odds;
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  state.races = await DATA_PROVIDER.getRaces();
  renderRaces();
});

// ================= UI: RACES =================
function renderRaces() {
  const section = document.querySelector(".section");
  section.innerHTML = "<h3>Live Races</h3>";

  state.races.forEach(r => {
    const div = document.createElement("div");
    div.className = "race-card";

    div.innerHTML = `${r.track} - Race ${r.race}<br><small>${r.time}</small>`;
    div.onclick = () => selectRace(r.track, r.race);

    section.appendChild(div);
  });
}

// ================= SELECT RACE =================
async function selectRace(track, race) {
  state.selectedTrack = track;
  state.selectedRace = race;

  state.odds = await DATA_PROVIDER.getOdds(track, race);

  openCalculator();
}

// ================= BET BUILDER =================
function openCalculator() {
  let panel = document.getElementById("betBuilder");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "betBuilder";
    document.body.appendChild(panel);
  }

  renderBetBuilder(panel);
}

function renderBetBuilder(panel) {
  panel.innerHTML = `
    <h3>${state.selectedTrack} Race ${state.selectedRace}</h3>

    <button onclick="setBetType('win')">Win</button>
    <button onclick="setBetType('exacta_box')">Exacta Box</button>
    <button onclick="setBetType('trifecta_box')">Trifecta Box</button>

    <div id="horseGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;"></div>

    <input type="number" placeholder="Stake" oninput="setStake(this.value)" />

    <div id="comboCount"></div>
    <div id="payoutResult"></div>

    <button onclick="placeBet()">Place Bet</button>
  `;

  renderHorseGrid();
}

// ================= HORSES =================
function renderHorseGrid() {
  const grid = document.getElementById("horseGrid");
  grid.innerHTML = "";

  Object.keys(state.odds).forEach(num => {
    const btn = document.createElement("button");

    btn.innerText = `${num} (${state.odds[num]})`;
    btn.onclick = () => toggleHorse(Number(num), btn);

    grid.appendChild(btn);
  });
}

function toggleHorse(horse, btn) {
  const idx = state.selectedHorses.indexOf(horse);

  if (idx > -1) {
    state.selectedHorses.splice(idx, 1);
    btn.style.background = "#fff";
  } else {
    state.selectedHorses.push(horse);
    btn.style.background = "#4caf50";
    btn.style.color = "#fff";
  }

  calculate();
}

// ================= STATE =================
function setBetType(type) {
  state.betType = type;
  state.selectedHorses = [];
  calculate();
}

function setStake(val) {
  state.stake = parseFloat(val) || 0;
  calculate();
}

// ================= ENGINE =================
function calculate() {
  const combos = getCombos();
  const payout = simulatePayout(combos);
  updateUI(combos, payout);
}

function getCombos() {
  const n = state.selectedHorses.length;

  if (state.betType === "win") return n;
  if (state.betType === "exacta_box" && n >= 2) return perm(n, 2);
  if (state.betType === "trifecta_box" && n >= 3) return perm(n, 3);

  return 0;
}

// ================= PAYOUT =================
function simulatePayout(combos) {
  if (!combos || !state.stake) return 0;

  const pool = 10000;
  const takeout = 0.18;
  const net = pool * (1 - takeout);
  const tickets = 1000;

  return (net / tickets) * combos;
}

// ================= MATH =================
function perm(n, r) {
  return fact(n) / fact(n - r);
}

function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
}

// ================= UI =================
function updateUI(combos, payout) {
  document.getElementById("comboCount").innerText = `Combos: ${combos}`;
  document.getElementById("payoutResult").innerText = `Payout: $${payout.toFixed(2)}`;
}

// ================= FIRESTORE SAVE =================
async function placeBet() {
  const bet = {
    track: state.selectedTrack,
    race: state.selectedRace,
    betType: state.betType,
    horses: state.selectedHorses,
    stake: state.stake,
    odds: state.odds,
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "bets"), bet);
    alert("Bet saved");
  } catch (err) {
    console.error(err);
    alert("Error saving bet");
  }

  resetState();
}

// ================= RESET =================
function resetState() {
  state.selectedHorses = [];
  state.betType = null;
  state.stake = 0;

  const panel = document.getElementById("betBuilder");
  if (panel) panel.remove();
}
