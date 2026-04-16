// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  await loadRaces();
  renderRaces();
  loadHistory();
  loadAdminStats();
});

// ================= DATA =================
async function loadRaces() {
  state.races = [
    { track: "Tampa", race: 1, time: "12:20 PM" },
    { track: "Parx", race: 3, time: "1:05 PM" }
  ];
}

async function loadOdds() {
  state.odds = {};
  for (let i = 1; i <= 8; i++) {
    state.odds[i] = (Math.random() * 10 + 2).toFixed(2);
  }
}

// ================= UI =================
function renderRaces() {
  const section = document.querySelector(".section");
  section.innerHTML = "<h3>Live Races</h3>";

  state.races.forEach(r => {
    const div = document.createElement("div");
    div.className = "race-card";
    div.innerText = `${r.track} - Race ${r.race}`;
    div.onclick = () => selectRace(r.track, r.race);
    section.appendChild(div);
  });
}

// ================= SELECT =================
async function selectRace(track, race) {
  state.selectedTrack = track;
  state.selectedRace = race;
  await loadOdds();
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

  panel.innerHTML = `
    <h3>${state.selectedTrack} Race ${state.selectedRace}</h3>

    <button onclick="setBetType('win')">Win</button>
    <button onclick="setBetType('exacta_box')">Exacta</button>

    <div id="horseGrid"></div>

    <input type="number" placeholder="Stake" oninput="setStake(this.value)" />

    <div id="payoutResult"></div>
    <div id="evResult"></div>
    <div id="valueSignal"></div>

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
}

function setStake(val) {
  state.stake = parseFloat(val) || 0;
  calculate();
}

// ================= ANALYTICS ENGINE =================
function calculate() {
  const prob = getProbability();
  const payout = getPayout();
  const ev = (prob * payout) - state.stake;

  const value = ev > 0 ? "VALUE BET" : "NO EDGE";

  updateUI(payout, ev, value);
}

function getProbability() {
  let p = 0;

  state.selectedHorses.forEach(h => {
    const odds = parseFloat(state.odds[h]);
    p += 1 / (odds + 1);
  });

  return Math.min(p, 1);
}

function getPayout() {
  return state.stake * 5; // simplified
}

// ================= UI =================
function updateUI(payout, ev, value) {
  document.getElementById("payoutResult").innerText = `Payout: $${payout.toFixed(2)}`;
  document.getElementById("evResult").innerText = `EV: $${ev.toFixed(2)}`;
  document.getElementById("valueSignal").innerText = value;
}

// ================= FIRESTORE =================
async function placeBet() {
  const bet = {
    ...state,
    createdAt: new Date().toISOString()
  };

  await addDoc(collection(db, "bets"), bet);

  loadHistory();
  loadAdminStats();
}

// ================= USER HISTORY =================
async function loadHistory() {
  const snap = await getDocs(collection(db, "bets"));
  const section = document.getElementById("historySection");

  section.innerHTML = "<h3>Bet History</h3>";

  snap.forEach(doc => {
    const bet = doc.data();

    const div = document.createElement("div");
    div.innerText = `${bet.track} R${bet.selectedRace} - $${bet.stake}`;

    section.appendChild(div);
  });
}

// ================= ADMIN DASHBOARD =================
async function loadAdminStats() {
  const snap = await getDocs(collection(db, "bets"));

  let totalBets = 0;
  let totalStake = 0;

  snap.forEach(doc => {
    const bet = doc.data();
    totalBets++;
    totalStake += bet.stake;
  });

  const section = document.getElementById("adminSection");

  section.innerHTML = `
    <h3>Admin Analytics</h3>
    Total Bets: ${totalBets}<br>
    Total Stake: $${totalStake}
  `;
}
