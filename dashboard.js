// Firebase imports
import { db, auth } from './firebase.js';

// Wait for user authentication before loading bets
onAuthStateChanged(auth, user => {
  if (user) {
    loadBets(user.uid);
  } else {
    window.location.href = "login.html"; // redirect if not logged in
  }
});

/**
 * Loads and listens for changes to bets
 */
function loadBets(userId) {
  const betsRef = collection(db, "bets");
  const q = query(
    betsRef,
    where("userId", "==", userId),
    orderBy("timestamp", "desc")
  );

  // Live updates
  onSnapshot(q, snapshot => {
    let betsData = [];
    snapshot.forEach(doc => {
      const bet = doc.data();

      // If winnings are missing but result is "win", calculate
      if (bet.result === "win" && (bet.winnings === undefined || bet.winnings === null)) {
        bet.winnings = (bet.amount * bet.odds).toFixed(2);
      }

      // If loss, set winnings to 0
      if (bet.result === "loss") {
        bet.winnings = 0;
      }

      betsData.push(bet);
    });

    renderBetsTable(betsData);
  });
}

/**
 * Renders bets into the dashboard table
 */
function renderBetsTable(bets) {
  const tableBody = document.getElementById("betsTableBody");
  tableBody.innerHTML = "";

  bets.forEach(bet => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${bet.horseName || "—"}</td>
      <td>${bet.trackName || "—"}</td>
      <td>${bet.betType || "—"}</td>
      <td>$${bet.amount?.toFixed(2) || "0.00"}</td>
      <td>${bet.result || "pending"}</td>
      <td>$${bet.winnings ? Number(bet.winnings).toFixed(2) : "0.00"}</td>
    `;

    tableBody.appendChild(tr);
  });
}<<<<<<< HEAD
// Firebase imports
import { db, auth } from './firebase.js';

// Wait for user authentication before loading bets
onAuthStateChanged(auth, user => {
  if (user) {
    loadBets(user.uid);
  } else {
    window.location.href = "login.html"; // redirect if not logged in
  }
});

=======
>>>>>>> origin/main
/**
 * User dashboard data loading + rendering
 * Uses Firebase compat SDK loaded in dashboard.html.
 */

const DASHBOARD_LIMIT = 100;

function normalizeBet(rawBet = {}) {
  const amount = Number(rawBet.betAmount ?? rawBet.amount ?? 0);
  const outcome = rawBet.outcome ?? rawBet.result ?? "pending";
  const winnings = Number(rawBet.winnings ?? 0);

  return {
    horseName: rawBet.horseName || "—",
    trackName: rawBet.trackName || "—",
    betType: rawBet.betType || "—",
    amount,
    outcome,
    winnings
  };
}

function calculateDashboardStats(bets) {
  const totalBets = bets.length;
  const totalWinnings = bets.reduce((sum, bet) => sum + bet.winnings, 0);
  const wins = bets.filter((bet) => bet.outcome === "win").length;
  const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

  return { totalBets, totalWinnings, winRate };
}

function renderDashboardStats(stats) {
  const totalBetsEl = document.getElementById("totalBets");
  const totalWinningsEl = document.getElementById("totalWinnings");
  const winRateEl = document.getElementById("winRate");

  if (totalBetsEl) totalBetsEl.textContent = String(stats.totalBets);
  if (totalWinningsEl) totalWinningsEl.textContent = `$${stats.totalWinnings.toFixed(2)}`;
  if (winRateEl) winRateEl.textContent = `${stats.winRate.toFixed(1)}%`;
}

function renderBetsTable(bets) {
  const tableBody = document.getElementById("betsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  bets.forEach((bet) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${bet.horseName}</td>
      <td>${bet.trackName}</td>
      <td>${bet.betType}</td>
      <td>$${bet.amount.toFixed(2)}</td>
      <td>${bet.outcome}</td>
      <td>$${bet.winnings.toFixed(2)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadBets(userId) {
  const statusEl = document.getElementById("dashboardStatus");
  if (statusEl) statusEl.textContent = "Loading your bets...";

  try {
    const snapshot = await db
      .collection("bets")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(DASHBOARD_LIMIT)
      .get();

    const bets = snapshot.docs.map((doc) => normalizeBet(doc.data()));
    renderBetsTable(bets);
    renderDashboardStats(calculateDashboardStats(bets));

    if (statusEl) statusEl.textContent = `Showing ${bets.length} recent bets.`;
  } catch (error) {
    console.error("Error loading dashboard bets:", error);
    if (statusEl) statusEl.textContent = "Error loading dashboard data.";
  }
}

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadBets(user.uid);
});
