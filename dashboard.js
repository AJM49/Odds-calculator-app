// Check if user is logged in
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadDashboardData(user.uid);
  }
});

function loadDashboardData(userId) {
  // Example Firestore fetch (adjust to your structure)
  const betsRef = firebase.firestore().collection("bets").where("userId", "==", userId);

  betsRef.get().then(snapshot => {
    let totalBets = snapshot.size;
    let totalWinnings = 0;
    let winCount = 0;
    let totalBetAmount = 0;

    const tableBody = document.querySelector("#betHistoryTable tbody");
    tableBody.innerHTML = "";

    snapshot.forEach(doc => {
      const bet = doc.data();
      totalBetAmount += bet.amount;
      if (bet.result === "win") {
        winCount++;
        totalWinnings += bet.winnings || 0;
      }

      tableBody.innerHTML += `
        <tr>
          <td>${new Date(bet.date).toLocaleDateString()}</td>
          <td>${bet.betType}</td>
          <td>$${bet.amount.toFixed(2)}</td>
          <td>${bet.odds}</td>
          <td>${bet.result}</td>
          <td>$${(bet.winnings || 0).toFixed(2)}</td>
        </tr>
      `;
    });

    document.getElementById("totalBets").innerText = totalBets;
    document.getElementById("totalWinnings").innerText = `$${totalWinnings.toFixed(2)}`;
    document.getElementById("winRate").innerText = totalBets > 0 ? `${((winCount / totalBets) * 100).toFixed(1)}%` : "0%";
    document.getElementById("avgBet").innerText = totalBets > 0 ? `$${(totalBetAmount / totalBets).toFixed(2)}` : "$0.00";
  });
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
});
