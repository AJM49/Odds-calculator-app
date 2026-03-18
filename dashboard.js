const auth = firebase.auth();
const db = firebase.firestore();
let currentUserId = null;
let unsubscribeBets = null;

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "login.html?next=dashboard.html";
    return;
  }

  currentUserId = user.uid;
  document.getElementById("dashboardSubtitle").textContent = `Live history and performance for ${user.email}.`;

  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (!currentUserId) return;
      document.getElementById("statusLine").textContent = "Refreshing...";
      loadBets(currentUserId);
    });
  }

  loadBets(user.uid);
});

function loadBets(userId) {
  if (typeof unsubscribeBets === "function") {
    unsubscribeBets();
  }

  unsubscribeBets = db.collection("bets")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
      const bets = [];
      snapshot.forEach((doc) => bets.push(doc.data()));
      renderBetsTable(bets);
      renderSummary(bets);
      document.getElementById("statusLine").textContent = `Updated ${new Date().toLocaleTimeString()} • ${bets.length} bet(s) loaded`;
    }, (error) => {
      console.error(error);
      document.getElementById("statusLine").textContent = "Unable to load bets right now.";
    });
}

function renderSummary(bets) {
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

  document.getElementById("totalBets").textContent = String(totalBets);
  document.getElementById("totalWinnings").textContent = `$${totalWinnings.toFixed(2)}`;
  document.getElementById("winRate").textContent = `${winRate.toFixed(1)}%`;
  document.getElementById("avgBet").textContent = `$${avgBet.toFixed(2)}`;
  document.getElementById("totalStaked").textContent = `$${totalAmount.toFixed(2)}`;
  document.getElementById("netProfit").textContent = `$${netProfit.toFixed(2)}`;
  document.getElementById("roi").textContent = `${roi.toFixed(1)}%`;
  document.getElementById("bestOdds").textContent =
    bestOddsValue === null ? "—" : `${bestOddsValue.toFixed(2)}x`;

  const netProfitEl = document.getElementById("netProfit");
  const roiEl = document.getElementById("roi");
  netProfitEl.classList.remove("metric-positive", "metric-negative");
  roiEl.classList.remove("metric-positive", "metric-negative");

  if (netProfit > 0) netProfitEl.classList.add("metric-positive");
  if (netProfit < 0) netProfitEl.classList.add("metric-negative");
  if (roi > 0) roiEl.classList.add("metric-positive");
  if (roi < 0) roiEl.classList.add("metric-negative");
}

function parseOddsToDecimal(odds) {
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
  const tableBody = document.getElementById("betsTableBody");
  const emptyState = document.getElementById("emptyState");
  tableBody.innerHTML = "";

  if (!bets.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  bets.forEach((bet) => {
    const tr = document.createElement("tr");
    const outcome = bet.outcome || "pending";

    tr.innerHTML = `
      <td>${bet.horseName || "—"}</td>
      <td>${bet.trackName || "—"}</td>
      <td>${bet.betType || "—"}</td>
      <td>$${Number(bet.betAmount || 0).toFixed(2)}</td>
      <td class="result-${outcome}">${outcome}</td>
      <td>$${Number(bet.winnings || 0).toFixed(2)}</td>
    `;

    tableBody.appendChild(tr);
  });
}
