// dashboard.js

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // Redirect to login if not authenticated
    window.location.href = "login.html";
    return;
  }

  console.log("Logged in as:", user.email);

  try {
    const betsRef = db.collection("bets").where("userId", "==", user.uid);
    betsRef.onSnapshot((snapshot) => {
      let totalBets = 0;
      let totalWinnings = 0;
      let wins = 0;
      let betsHTML = "";

      if (snapshot.empty) {
        betsHTML = `<tr><td colspan="6" style="text-align:center;">No bets found.</td></tr>`;
      } else {
        snapshot.forEach((doc) => {
          const bet = doc.data();
          totalBets++;

          const date = bet.date ? new Date(bet.date.seconds * 1000).toLocaleDateString() : "N/A";
          const horse = bet.horse || "N/A";
          const betType = bet.betType || "N/A";
          const amount = bet.amount ? `$${bet.amount.toFixed(2)}` : "$0.00";
          const status = bet.status || "pending";
          const winnings = bet.winnings ? `$${bet.winnings.toFixed(2)}` : "$0.00";

          if (status.toLowerCase() === "win") {
            wins++;
            totalWinnings += bet.winnings || 0;
          }

          betsHTML += `
            <tr>
              <td>${date}</td>
              <td>${horse}</td>
              <td>${betType}</td>
              <td>${amount}</td>
              <td class="${status.toLowerCase()}">${status}</td>
              <td>${winnings}</td>
            </tr>
          `;
        });
      }

      // Update stats
      document.getElementById("totalBets").textContent = totalBets;
      document.getElementById("totalWinnings").textContent = `$${totalWinnings.toFixed(2)}`;
      document.getElementById("winRate").textContent = totalBets > 0 ? `${((wins / totalBets) * 100).toFixed(1)}%` : "0%";

      // Populate table
      document.getElementById("betHistoryTable").innerHTML = betsHTML;
    });
  } catch (error) {
    console.error("Error loading bets:", error);
    document.getElementById("betHistoryTable").innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Error loading bets</td></tr>`;
  }
});
