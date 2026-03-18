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

  document.getElementById("totalBets").textContent = String(totalBets);
  document.getElementById("totalWinnings").textContent = `$${totalWinnings.toFixed(2)}`;
  document.getElementById("winRate").textContent = `${winRate.toFixed(1)}%`;
  document.getElementById("avgBet").textContent = `$${avgBet.toFixed(2)}`;
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
