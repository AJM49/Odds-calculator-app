// ===============================
// dashboard.js - User Dashboard
// ===============================

// -------------------------------
// Firebase Initialization
// (Make sure your firebaseConfig is already defined in firebase-config.js)
// -------------------------------
// ===== FIREBASE INIT =====
const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  storageBucket: "horse-bet-calculator.firebasestorage.app",
  messagingSenderId: "258212871291",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de",
};

// Firestore reference
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const totalBetsEl = document.getElementById("totalBets");
const totalWinningsEl = document.getElementById("totalWinnings");
const activeUsersEl = document.getElementById("activeUsers");
const betHistoryTable = document.getElementById("betHistoryTable")?.querySelector("tbody");

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.warn("No user signed in, redirecting to login...");
    window.location.href = "login.html";
    return;
  }

  console.log("User signed in:", user.email, "UID:", user.uid);

  // Get user role
  const userDoc = await db.collection("users").doc(user.uid).get();
  const role = userDoc.exists ? userDoc.data().role : "user";
  console.log("User role:", role);

  if (role === "admin") {
    loadAdminStats();
  } else {
    loadUserStats(user.uid);
  }
});

/**
 * Admin view: Show all bets & user stats
 */
async function loadAdminStats() {
  console.log("Loading admin dashboard...");

  try {
    const betsSnapshot = await db.collection("bets").get();
    console.log("Bets found:", betsSnapshot.size);

    let totalBets = 0;
    let totalWinnings = 0;
    let usersSet = new Set();

    betsSnapshot.forEach(doc => {
      const bet = doc.data();
      console.log("Bet document:", doc.id, bet);

      totalBets++;
      totalWinnings += bet.winnings || 0;
      if (bet.userEmail) usersSet.add(bet.userEmail);

      addBetRow(bet);
    });

    updateDashboardUI(totalBets, totalWinnings, usersSet.size);

  } catch (error) {
    console.error("Error loading admin stats:", error);
  }
}

/**
 * User view: Show only their bets
 */
async function loadUserStats(uid) {
  console.log("Loading user dashboard for UID:", uid);

  try {
    const betsSnapshot = await db.collection("bets")
      .where("userId", "==", uid)
      .get();

    console.log("User bets found:", betsSnapshot.size);

    let totalBets = 0;
    let totalWinnings = 0;

    betsSnapshot.forEach(doc => {
      const bet = doc.data();
      console.log("User bet:", doc.id, bet);

      totalBets++;
      totalWinnings += bet.winnings || 0;
      addBetRow(bet);
    });

    updateDashboardUI(totalBets, totalWinnings);

  } catch (error) {
    console.error("Error loading user stats:", error);
  }
}

/**
 * Add a bet row to the table
 */
function addBetRow(bet) {
  if (!betHistoryTable) return;

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${bet.date || "-"}</td>
    <td>${bet.type || "-"}</td>
    <td>$${(bet.amount || 0).toFixed(2)}</td>
    <td>$${(bet.winnings || 0).toFixed(2)}</td>
    <td>${bet.userEmail || "-"}</td>
  `;

  betHistoryTable.appendChild(row);
}

/**
 * Update dashboard cards
 */
function updateDashboardUI(totalBets, totalWinnings, activeUsers = null) {
  if (totalBetsEl) totalBetsEl.innerText = totalBets;
  if (totalWinningsEl) totalWinningsEl.innerText = `$${totalWinnings.toFixed(2)}`;
  if (activeUsersEl && activeUsers !== null) activeUsersEl.innerText = activeUsers;
}

/**
 * Update winnings (manual or API-driven)
 */
async function updateWinnings(betId, payoutAmount) {
  try {
    await db.collection("bets").doc(betId).update({
      winnings: payoutAmount
    });
    console.log(`Updated winnings for bet ${betId} to $${payoutAmount.toFixed(2)}`);
  } catch (error) {
    console.error("Error updating winnings:", error);
  }
}

