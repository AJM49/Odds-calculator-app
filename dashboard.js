const auth = firebase.auth();
const db = firebase.firestore();
let currentUserId = null;
// Keep one active Firestore subscription to avoid duplicate listeners on refresh.
let unsubscribeBets = null;
let isRefreshBound = false;

const ui = {
  subtitle: document.getElementById("dashboardSubtitle"),
  statusLine: document.getElementById("statusLine"),
  refreshBtn: document.getElementById("refreshBtn"),
  totalBets: document.getElementById("totalBets"),
  totalWinnings: document.getElementById("totalWinnings"),
  winRate: document.getElementById("winRate"),
  avgBet: document.getElementById("avgBet"),
  totalStaked: document.getElementById("totalStaked"),
  netProfit: document.getElementById("netProfit"),
  roi: document.getElementById("roi"),
  bestOdds: document.getElementById("bestOdds"),
  tableBody: document.getElementById("betsTableBody"),
  emptyState: document.getElementById("emptyState"),
};

auth.onAuthStateChanged((user) => {
  if (!user) {
    // Preserve destination so login can return users to dashboard.
    window.location.href = "login.html?next=dashboard.html";
    return;
  }

  currentUserId = user.uid;
  ui.subtitle.textContent = `Live history and performance for ${user.email}.`;
  bindRefreshButton();

  loadBets(user.uid);
});

function bindRefreshButton() {
  if (!ui.refreshBtn || isRefreshBound) return;

  ui.refreshBtn.addEventListener("click", () => {
    if (!currentUserId) return;
    ui.statusLine.textContent = "Refreshing...";
    loadBets(currentUserId);
  });

  isRefreshBound = true;
}

function getBetSortTime(bet) {
  if (typeof bet?.createdAtMs === "number" && Number.isFinite(bet.createdAtMs)) {
    return bet.createdAtMs;
  }
  if (bet?.timestamp && typeof bet.timestamp.toDate === "function") {
    return bet.timestamp.toDate().getTime();
  }
  return 0;
}

function sortBetsNewestFirst(bets) {
  return [...bets].sort((a, b) => getBetSortTime(b) - getBetSortTime(a));
}

function toCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function setMetricTone(element, value) {
  element.classList.remove("metric-positive", "metric-negative");
  if (value > 0) element.classList.add("metric-positive");
  if (value < 0) element.classList.add("metric-negative");
}

function loadBets(userId) {
  if (typeof unsubscribeBets === "function") {
    // Dispose previous listener before creating a new live query.
    unsubscribeBets();
  }

  const handleSnapshot = (snapshot) => {
    const bets = [];
    snapshot.forEach((doc) => bets.push(doc.data()));
    const sortedBets = sortBetsNewestFirst(bets);
    renderBetsTable(sortedBets);
    renderSummary(sortedBets);
    ui.statusLine.textContent = `Updated ${new Date().toLocaleTimeString()} • ${sortedBets.length} bet(s) loaded`;
  };

  // Prefer ordered stream; if index/order query fails, degrade gracefully to unordered stream.
  const orderedQuery = db.collection("bets")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc");

  unsubscribeBets = orderedQuery.onSnapshot(handleSnapshot, (error) => {
    console.error(error);

    // Fallback path for missing index / ordering failures.
    if (typeof unsubscribeBets === "function") {
      unsubscribeBets();
    }

    unsubscribeBets = db.collection("bets")
      .where("userId", "==", userId)
      .onSnapshot(handleSnapshot, (fallbackError) => {
        console.error(fallbackError);
        ui.statusLine.textContent = "Unable to load bets right now.";
      });
  });
}

function renderSummary(bets) {
  // Core totals and rate metrics displayed in analytics cards.
  const totalBets = bets.length;
  const totalWinnings = bets.reduce((sum, bet) => sum + Number(bet.winnings || 0), 0);
  const totalAmount = bets.reduce((sum, bet) => sum + Number(bet.betAmount || 0), 0);
  const wins = bets.filter((bet) => bet.outcome === "win").length;
  const winRate = totalBets ? (wins / totalBets) * 100 : 0;
  const avgBet = totalBets ? totalAmount / totalBets : 0;
  const netProfit = totalWinnings - totalAmount;
  const roi = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0;
  const bestOddsValue = bets.reduce((best, bet) => {
    const current = parseOddsToDecimal(bet.odds);
    if (current === null) return best;
    if (best === null || current > best) return current;
    return best;
  }, null);

  ui.totalBets.textContent = String(totalBets);
  ui.totalWinnings.textContent = toCurrency(totalWinnings);
  ui.winRate.textContent = `${winRate.toFixed(1)}%`;
  ui.avgBet.textContent = toCurrency(avgBet);
  ui.totalStaked.textContent = toCurrency(totalAmount);
  ui.netProfit.textContent = toCurrency(netProfit);
  ui.roi.textContent = `${roi.toFixed(1)}%`;
  ui.bestOdds.textContent =
    bestOddsValue === null ? "—" : `${bestOddsValue.toFixed(2)}x`;

  // Color-code profit/ROI to make gains/losses obvious at a glance.
  setMetricTone(ui.netProfit, netProfit);
  setMetricTone(ui.roi, roi);
}

function parseOddsToDecimal(odds) {
  // Normalize multiple odds formats so "Best Odds" is comparable.
  if (!odds) return null;
  const normalized = String(odds).replaceAll(",", "").trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "EVEN" || normalized === "EVENS" || normalized === "EVS") {
    return 2;
  }

  if (normalized.includes("/")) {
    const [n, d] = normalized.split("/");
    const num = Number(n);
    const den = Number(d);
    if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
    return 1 + num / den;
  }

  if (/^[+-]\d+$/.test(normalized)) {
    const american = Number(normalized);
    if (!Number.isFinite(american) || Math.abs(american) < 100) return null;
    if (american > 0) return 1 + american / 100;
    return 1 + 100 / Math.abs(american);
  }

  const decimal = Number(normalized);
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return decimal;
}

function renderBetsTable(bets) {
  ui.tableBody.innerHTML = "";

  if (!bets.length) {
    ui.emptyState.style.display = "block";
    return;
  }

  ui.emptyState.style.display = "none";

  bets.forEach((bet) => {
    const tr = document.createElement("tr");
    const outcome = bet.outcome || "pending";

    tr.innerHTML = `
      <td>${bet.horseName || "—"}</td>
      <td>${bet.trackName || "—"}</td>
      <td>${bet.betType || "—"}</td>
      <td>${toCurrency(bet.betAmount)}</td>
      <td class="result-${outcome}">${outcome}</td>
      <td>${toCurrency(bet.winnings)}</td>
    `;

    ui.tableBody.appendChild(tr);
  });
}
