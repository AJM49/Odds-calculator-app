// ===============================
// dashboard.js - User Dashboard
// ===============================

// -------------------------------
// Firebase Initialization
// (Make sure your firebaseConfig is already defined in firebase-config.js)
// -------------------------------
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// -------------------------------
// Load and display user dashboard stats
// -------------------------------
function loadUserDashboard(userId) {
    const betHistoryBody = document.getElementById("betHistoryBody");
    const statTotalBets = document.getElementById("statTotalBets");
    const statTotalWinnings = document.getElementById("statTotalWinnings");
    const statWinRate = document.getElementById("statWinRate");

    // Reset dashboard display
    betHistoryBody.innerHTML = "";
    statTotalBets.textContent = "0";
    statTotalWinnings.textContent = "$0.00";
    statWinRate.textContent = "0%";

    let totalBets = 0;
    let totalWinnings = 0;
    let wins = 0;

    db.collection("bets")
        .where("userId", "==", userId)
        .orderBy("date", "desc")
        .get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const bet = doc.data();
                totalBets++;
                totalWinnings += bet.winnings || 0;

                if (bet.result && bet.result.toLowerCase() === "win") {
                    wins++;
                }

                // Create bet history table row
                const row = `
                    <tr>
                        <td>${bet.date || "N/A"}</td>
                        <td>${bet.betType || "N/A"}</td>
                        <td>$${bet.amount ? bet.amount.toFixed(2) : "0.00"}</td>
                        <td>${bet.result || "N/A"}</td>
                        <td>$${bet.winnings ? bet.winnings.toFixed(2) : "0.00"}</td>
                    </tr>
                `;
                betHistoryBody.insertAdjacentHTML("beforeend", row);
            });

            // Update stat cards
            statTotalBets.textContent = totalBets;
            statTotalWinnings.textContent = `$${totalWinnings.toFixed(2)}`;
            statWinRate.textContent =
                totalBets > 0 ? `${((wins / totalBets) * 100).toFixed(1)}%` : "0%";
        })
        .catch((error) => {
            console.error("Error loading dashboard:", error);
        });
}

// -------------------------------
// Auth State Listener
// -------------------------------
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log(`User logged in: ${user.email}`);
        loadUserDashboard(user.uid);
    } else {
        console.log("User is not logged in, redirecting...");
        window.location.href = "login.html"; // Redirect if not logged in
    }
});
