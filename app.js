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
  await loadAnalytics();
});

// ================= DEMO RACES =================
function renderDemoRaces() {
  const section = document.querySelector(".section");
  section.innerHTML = "<h3>Races</h3>";

  ["Tampa R1", "Parx R3"].forEach(r => {
    const div = document.createElement("div");
    div.className = "race-card";
    div.innerText = r;
    div.onclick = () => selectRace(r);
    section.appendChild(div);
  });
}

// ================= SELECT =================
function selectRace(label) {
  state.selectedTrack = label;
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
    <h3>${state.selectedTrack}</h3>

    <button onclick="setBetType('win')">Win</button>
    <button onclick="setBetType('exacta')">Exacta</button>

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
  state.selectedHorses = [];
}

function setStake(v) {
  state.stake = parseFloat(v) || 0;
}

// ================= PLACE BET =================
async function placeBet() {
  const bet = {
    ...state,
    result: "pending",
    payout: 0,
    createdAt: new Date().toISOString()
  };

  await addDoc(collection(db, "bets"), bet);
  await loadAnalytics();
}

// ================= SETTLE BET =================
async function settleBet(id, result, payout) {
  const ref = doc(db, "bets", id);
  await updateDoc(ref, { result, payout });
  await loadAnalytics();
}

// ================= ANALYTICS =================
async function loadAnalytics() {
  const snap = await getDocs(collection(db, "bets"));

  let stake = 0;
  let returns = 0;
  let wins = 0;
  let total = 0;

  const curve = [];

  snap.forEach(d => {
    const b = d.data();

    total++;
    stake += b.stake;

    if (b.result === "win") {
      wins++;
      returns += b.payout;
    }

    curve.push(b.payout - b.stake);
  });

  const roi = stake ? ((returns - stake) / stake) * 100 : 0;
  const winRate = total ? (wins / total) * 100 : 0;

  renderPerformance(roi, winRate, stake, returns);
  renderChart(curve);
  renderSignals(snap);
}

// ================= PERFORMANCE =================
function renderPerformance(roi, winRate, stake, returns) {
  document.getElementById("performanceSection").innerHTML = `
    <h3>Performance</h3>
    ROI: ${roi.toFixed(2)}%<br>
    Win Rate: ${winRate.toFixed(2)}%<br>
    Stake: $${stake}<br>
    Return: $${returns}
  `;
}

// ================= CHART =================
function renderChart(curve) {
  const ctx = document.getElementById("roiChart");

  let sum = 0;
  const cumulative = curve.map(v => (sum += v));

  new Chart(ctx, {
    type: "line",
    data: {
      labels: cumulative.map((_, i) => i + 1),
      datasets: [{ label: "Profit", data: cumulative }]
    }
  });
}

// ================= SIGNALS =================
function renderSignals(snap) {
  let sharp = 0;
  let publicBets = 0;

  snap.forEach(d => {
    const b = d.data();

    let implied = 0;
    b.selectedHorses.forEach(h => {
      const o = parseFloat(b.odds[h]);
      implied += 1 / (o + 1);
    });

    if (implied < 0.5) sharp++;
    else publicBets++;
  });

  document.getElementById("performanceSection").innerHTML += `
    <h4>Market Signals</h4>
    Sharp: ${sharp}<br>
    Public: ${publicBets}
  `;
}
