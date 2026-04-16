// ================= FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔴 REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= STATE =================
const state = {
  selectedTrack: null,
  selectedRace: null,
  betType: null,
  selectedHorses: [],
  keyHorse: null,
  stake: 0,
  odds: {}, // horse -> odds
  pool: 10000, // simulated pool size
  takeout: 0.18
};

// ================= NAV =================
function selectRace(track, race) {
  state.selectedTrack = track;
  state.selectedRace = race;

  loadOdds(); // fetch odds
  openCalculator();
}

function openCalculator() {
  showBetBuilder();
}

function goHome() {
  resetState();
}

// ================= ODDS =================
async function loadOdds() {
  // MOCK API (replace later)
  const horses = 8;

  state.odds = {};

  for (let i = 1; i <= horses; i++) {
    // random odds between 2.0 - 15.0
    state.odds[i] = (Math.random() * 13 + 2).toFixed(2);
  }

  console.log("Odds loaded:", state.odds);
}

// ================= UI =================
function showBetBuilder() {
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

    <div>
      <button onclick="setBetType('win')">Win</button>
      <button onclick="setBetType('exacta_box')">Exacta Box</button>
      <button onclick="setBetType('trifecta_box')">Trifecta Box</button>
    </div>

    <div id="horseGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;"></div>

    <input type="number" placeholder="Stake" oninput="setStake(this.value)" />

    <div id="comboCount"></div>
    <div id="payoutResult"></div>
    <div id="evResult"></div>

    <button onclick="placeBet()">Place Bet</button>
  `;

  renderHorseGrid(8);
}

// ================= HORSES =================
function renderHorseGrid(total) {
  const grid = document.getElementById("horseGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    const odds = state.odds[i] || "?";

    btn.innerText = `${i} (${odds})`;

    btn.onclick = () => toggleHorse(i, btn);

    grid.appendChild(btn);
  }
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
  const combos = getCombinations();
  const probability = getProbability();
  const payout = simulatePayout(combos);
  const ev = (probability * payout) - state.stake;

  updateUI(combos, payout, ev);
}

// ================= COMBINATIONS =================
function getCombinations() {
  const n = state.selectedHorses.length;

  if (state.betType === "win") return n;
  if (state.betType === "exacta_box" && n >= 2) return permutations(n, 2);
  if (state.betType === "trifecta_box" && n >= 3) return permutations(n, 3);

  return 0;
}

// ================= PROBABILITY =================
function getProbability() {
  let prob = 0;

  state.selectedHorses.forEach(h => {
    const odds = parseFloat(state.odds[h]);
    prob += 1 / odds;
  });

  return Math.min(prob, 1);
}

// ================= PARI-MUTUEL =================
function simulatePayout(combos) {
  if (combos === 0 || state.stake === 0) return 0;

  const poolAfterTakeout = state.pool * (1 - state.takeout);
  const totalBets = 1000; // simulated tickets

  const payoutPerCombo = poolAfterTakeout / totalBets;

  return payoutPerCombo * combos;
}

// ================= MATH =================
function permutations(n, r) {
  return factorial(n) / factorial(n - r);
}

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// ================= UI =================
function updateUI(combos, payout, ev) {
  document.getElementById("comboCount").innerText = `Combos: ${combos}`;
  document.getElementById("payoutResult").innerText = `Payout: $${payout.toFixed(2)}`;
  document.getElementById("evResult").innerText = `EV: $${ev.toFixed(2)}`;
}

// ================= FIRESTORE =================
async function placeBet() {
  const bet = {
    ...state,
    timestamp: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "bets"), bet);
    alert("Bet saved");
  } catch (e) {
    console.error(e);
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
