// ================================
// GLOBAL STATE
// ================================
const state = {
  selectedTrack: null,
  selectedRace: null,
  betType: null,
  selectedHorses: [],
  stake: 0,
  oddsData: {}, // future API hook
};

// ================================
// INIT
// ================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("App initialized");
});

// ================================
// RACE SELECTION
// ================================
function selectRace(track, race) {
  state.selectedTrack = track;
  state.selectedRace = race;

  console.log("Race selected:", state);

  openCalculator();
}

// ================================
// NAVIGATION
// ================================
function openCalculator() {
  showBetBuilder();
}

function goHome() {
  resetState();
  console.log("Home");
}

function viewBets() {
  console.log("View Bets");
}

function viewHistory() {
  console.log("View History");
}

function openSettings() {
  console.log("Settings");
}

// ================================
// BET BUILDER UI
// ================================
function showBetBuilder() {
  let panel = document.getElementById("betBuilder");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "betBuilder";
    panel.style.position = "fixed";
    panel.style.bottom = "0";
    panel.style.left = "0";
    panel.style.width = "100%";
    panel.style.background = "#fff";
    panel.style.color = "#000";
    panel.style.padding = "15px";
    panel.style.borderTopLeftRadius = "12px";
    panel.style.borderTopRightRadius = "12px";
    panel.style.boxShadow = "0 -2px 10px rgba(0,0,0,0.3)";

    document.body.appendChild(panel);
  }

  function renderBetBuilder(panel) {
  panel.innerHTML = `
    <h3>${state.selectedTrack} - Race ${state.selectedRace}</h3>

    <div><strong>Select Bet Type</strong></div>
    <div id="betTypes" style="display:flex; gap:10px; margin-bottom:10px;">
      <button onclick="setBetType('win')">Win</button>
      <button onclick="setBetType('exacta')">Exacta</button>
      <button onclick="setBetType('trifecta')">Trifecta</button>
    </div>

    <div><strong>Select Horses</strong></div>
    <div id="horseGrid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;"></div>

    <div style="margin-top:10px;">
      <strong>Stake</strong>
      <input type="number" placeholder="Amount" oninput="setStake(this.value)" />
    </div>

    <div id="comboCount">Combinations: 0</div>
    <div id="payoutResult">Payout: $0.00</div>

    <button onclick="placeBet()">Place Bet</button>
  `;

  renderHorseGrid(8); // default 8 horses
}
  function renderHorseGrid(totalHorses) {
  const grid = document.getElementById("horseGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= totalHorses; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;

    btn.onclick = () => toggleHorse(i, btn);

    btn.style.padding = "10px";
    btn.style.borderRadius = "8px";
    btn.style.border = "1px solid #ccc";

    grid.appendChild(btn);
  }
}

function toggleHorse(horse, btn) {
  const index = state.selectedHorses.indexOf(horse);

  if (index > -1) {
    state.selectedHorses.splice(index, 1);
    btn.style.background = "#fff";
  } else {
    state.selectedHorses.push(horse);
    btn.style.background = "#4caf50";
    btn.style.color = "#fff";
  }

  calculatePayout();
}
  function calculatePayout() {
  let combos = 0;
  let payout = 0;

  const n = state.selectedHorses.length;
  const stake = state.stake || 0;

  if (!state.betType || n === 0 || stake === 0) {
    updateUI(0, 0);
    return;
  }

  switch (state.betType) {
    case "win":
      combos = n;
      payout = stake * 2;
      break;

    case "exacta":
      if (n < 2) return updateUI(0, 0);
      combos = factorial(n) / factorial(n - 2);
      payout = stake * combos * 5;
      break;

    case "trifecta":
      if (n < 3) return updateUI(0, 0);
      combos = factorial(n) / factorial(n - 3);
      payout = stake * combos * 10;
      break;
  }

  updateUI(combos, payout);
}
// ================================
// STATE UPDATES
// ================================
function setBetType(type) {
  state.betType = type;
  calculatePayout();
}

function setHorses(input) {
  state.selectedHorses = input.split(",").map(h => h.trim());
  calculatePayout();
}

function setStake(amount) {
  state.stake = parseFloat(amount) || 0;
  calculatePayout();
}
  function factorial(num) {
  if (num <= 1) return 1;
  return num * factorial(num - 1);
}

// ================================
// CALCULATION ENGINE (PLACEHOLDER)
// ================================
function calculatePayout() {
  let payout = 0;

  if (!state.betType || state.selectedHorses.length === 0) {
    updatePayoutUI(0);
    return;
  }

  // SIMPLE MOCK LOGIC (REPLACE WITH REAL ENGINE)
  const baseOdds = 2;

  switch (state.betType) {
    case "win":
      payout = state.stake * baseOdds;
      break;

    case "exacta":
      payout = state.stake * baseOdds * 5;
      break;

    case "trifecta":
      payout = state.stake * baseOdds * 10;
      break;
  }

  updatePayoutUI(payout);
}

// ================================
// UI UPDATE
// ================================
function updateUI(combos, payout) {
  const comboEl = document.getElementById("comboCount");
  const payoutEl = document.getElementById("payoutResult");

  if (comboEl) comboEl.innerText = `Combinations: ${combos}`;
  if (payoutEl) payoutEl.innerText = `Payout: $${payout.toFixed(2)}`;
}

// ================================
// BET ACTION
// ================================
function placeBet() {
  if (!state.betType || state.stake <= 0) {
    alert("Complete bet details");
    return;
  }

  const bet = {
    track: state.selectedTrack,
    race: state.selectedRace,
    type: state.betType,
    horses: state.selectedHorses,
    stake: state.stake,
    timestamp: new Date().toISOString(),
  };

  console.log("Bet placed:", bet);

  // FUTURE: Save to Firebase
  // saveBetToFirestore(bet);

  alert("Bet placed successfully");

  resetState();
}

// ================================
// RESET
// ================================
function resetState() {
  state.selectedTrack = null;
  state.selectedRace = null;
  state.betType = null;
  state.selectedHorses = [];
  state.stake = 0;

  const panel = document.getElementById("betBuilder");
  if (panel) panel.remove();
}
