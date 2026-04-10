// Firebase imports
import { db, auth, onAuthStateChanged } from './firebase.js';

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
  // Fetch bets and display them
  fetchAndRenderBets(userId);
}

async function fetchAndRenderBets(userId) {
  try {
    const snapshot = await db
      .collection("bets")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const bets = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        horseName: data.horseName || "—",
        trackName: data.trackName || "—",
        betType: data.betType || "—",
        amount: Number(data.betAmount ?? data.amount ?? 0),
        outcome: data.outcome ?? data.result ?? "pending",
        winnings: Number(data.winnings ?? 0)
      };
    });

    renderBetsTable(bets);
  } catch (error) {
    console.error("Error loading bets:", error);
  }
}

/**
 * Renders bets into the dashboard table
 */
function renderBetsTable(bets) {
  const tableBody = document.getElementById("betsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  bets.forEach(bet => {
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
