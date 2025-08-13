// dashboard.js
// ========================
// Firebase initialization (make sure firebase-config.js is loaded before this)
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements for stats
const totalBetsEl = document.getElementById("totalBets");
const totalWinningsEl = document.getElementById("totalWinnings");
const winRateEl = document.getElementById("winRate");
const betHistoryTable = document.getElementById("betHistoryTable");

// Listen for authentication state
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html"; // Redirect if not logged in
    return;
  }
  console.log(`Logged in as: ${user.email}`);
  loadDashboard(user.uid);
});

// Load dashboard data
async function loadDashboard(userId) {
  try {
    const betsSnapshot = await db
      .collection("bets")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .get();

    let totalBets = 0;
    let totalWinnings = 0;
    let wins = 0;
    let rowsHTML = "";

    betsSnapshot.forEach((doc) => {
      const bet = doc.data();
      totalBets++;

      // Calculate winnings (simplified logic)
      let winnings = 0;
      if (bet.result && bet.result.toLowerCase() === "win") {
        winnings = bet.amount * bet.odds;
        totalWinnings += winnings;
        wins++;
      }

      rowsHTML += `
        <tr>
          <td>${bet.horseName}</td>
          <td>${bet.amount}</td>
          <td>${bet.odds}</td>
          <td>${bet.result || "Pending"}</td>
          <td>${winnings.toFixed(2)}</td>
        </tr>
      `;
    });

    // Update UI
    totalBetsEl.textContent = totalBets;
    totalWinningsEl.textContent = `$${totalWinnings.toFixed(2)}`;
    winRateEl.textContent = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) + "%" : "0%";
    betHistoryTable.innerHTML = rowsHTML;

  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
}
