// ================= STATE =================
const state = {
  selectedTrack: null,
  selectedRace: null,
  betType: null,
  selectedHorses: [],
  keyHorse: null,
  stake: 0
};

// ================= NAV =================
function selectRace(track, race) {
  state.selectedTrack = track;
  state.selectedRace = race;
  openCalculator();
}

function openCalculator() {
  showBetBuilder();
}

function goHome() {
  resetState();
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
    <h3>${state.selectedTrack || ""} Race ${state.selectedRace || ""}</h3>

    <div>
      <button onclick="setBetType('win')">Win</button>
      <button onclick="setBetType('exacta_box')">Exacta Box</button>
      <button onclick="setBetType('exacta_key')">Exacta Key</button>
      <button onclick="setBetType('trifecta_box')">Trifecta Box</button>
      <button onclick="setBetType('trifecta_key')">Trifecta Key</button>
    </div>

    <h4>Horses</h4>
    <div id="horseGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;"></div>

    <input type="number" placeholder="Stake" oninput="setStake(this.value)" />

    <div id="comboCount">Combinations: 0</div>
    <div id="payoutResult">Payout: $0.00</div>

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
    btn.innerText = i;
    btn.className = "horse-btn";

    btn.onclick = () => toggleHorse(i, btn);

    grid.appendChild(btn);
  }
}

function toggleHorse(horse, btn) {
  if (state.betType?.includes("key")) {
    state.keyHorse = horse;

    document.querySelectorAll(".horse-btn").forEach(b => {
      b.style.background = "#fff";
      b.style.color = "#000";
    });

    btn.style.background = "#ff9800";
    btn.style.color = "#fff";

  } else {
    const idx = state.selectedHorses.indexOf(horse);

    if (idx > -1) {
      state.selectedHorses.splice(idx, 1);
      btn.style.background = "#fff";
    } else {
      state.selectedHorses.push(horse);
      btn.style.background = "#4caf50";
      btn.style.color = "#fff";
    }
  }

  calculatePayout();
}

// ================= STATE =================
function setBetType(type) {
  state.betType = type;
  state.selectedHorses = [];
  state.keyHorse = null;
  calculatePayout();
}

function setStake(val) {
  state.stake = parseFloat(val) || 0;
  calculatePayout();
}

// ================= ENGINE =================
function calculatePayout() {
  let combos = 0;
  let payout = 0;

  const n = state.selectedHorses.length;
  const stake = state.stake;

  switch (state.betType) {

    case "win":
      combos = n;
      payout = stake * 2;
      break;

    case "exacta_box":
      if (n >= 2) {
        combos = permutations(n, 2);
        payout = combos * stake * 5;
      }
      break;

    case "exacta_key":
      if (state.keyHorse && n >= 1) {
        combos = n * 2;
        payout = combos * stake * 5;
      }
      break;

    case "trifecta_box":
      if (n >= 3) {
        combos = permutations(n, 3);
        payout = combos * stake * 10;
      }
      break;

    case "trifecta_key":
      if (state.keyHorse && n >= 2) {
        combos = permutations(n, 2);
        payout = combos * stake * 10;
      }
      break;
  }

  updateUI(combos, payout);
}

// ================= MATH =================
function permutations(n, r) {
  return factorial(n) / factorial(n - r);
}

function factorial(num) {
  if (num <= 1) return 1;
  return num * factorial(num - 1);
}

// ================= UI UPDATE =================
function updateUI(combos, payout) {
  const c = document.getElementById("comboCount");
  const p = document.getElementById("payoutResult");

  if (c) c.innerText = `Combinations: ${combos}`;
  if (p) p.innerText = `Payout: $${payout.toFixed(2)}`;
}

// ================= BET =================
function placeBet() {
  console.log("BET:", state);
  alert("Bet placed");

  resetState();
}

// ================= RESET =================
function resetState() {
  state.selectedTrack = null;
  state.selectedRace = null;
  state.betType = null;
  state.selectedHorses = [];
  state.keyHorse = null;
  state.stake = 0;

  const panel = document.getElementById("betBuilder");
  if (panel) panel.remove();
}
