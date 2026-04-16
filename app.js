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

  renderBetBuilder(panel);
}

// ================================
// RENDER BET BUILDER
// ================================
function renderBetBuilder(panel) {
  panel.innerHTML = `
    <h3>${state.selectedTrack} - Race ${state.selectedRace}</h3>

    <label>Bet Type</label>
    <select onchange="setBetType(this.value)">
      <option value="">Select</option>
      <option value="win">Win</option>
      <option value="exacta">Exacta</option>
      <option value="trifecta">Trifecta</option>
    </select>

    <label>Horses (comma separated)</label>
    <input type="text" placeholder="e.g. 1,2,3" oninput="setHorses(this.value)" />

    <label>Stake</label>
    <input type="number" oninput="setStake(this.value)" />

    <div id="payoutResult">Payout: $0.00</div>

    <button onclick="placeBet()">Place Bet</button>
  `;
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
function updatePayoutUI(amount) {
  const el = document.getElementById("payoutResult");
  if (el) {
    el.innerText = `Payout: $${amount.toFixed(2)}`;
  }
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
