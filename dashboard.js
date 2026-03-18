const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadBets(user.uid);
});

function loadBets(userId) {
  db.collection("bets")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
      const bets = [];
      snapshot.forEach((doc) => bets.push(doc.data()));
      renderBetsTable(bets);
      renderSummary(bets);
    });
}

function renderSummary(bets) {
  const totalBets = bets.length;
  const totalWinnings = bets.reduce((sum, bet) => sum + Number(bet.winnings || 0), 0);
  const wins = bets.filter((bet) => bet.outcome === "win").length;
  const winRate = totalBets ? (wins / totalBets) * 100 : 0;

  document.getElementById("totalBets").textContent = String(totalBets);
  document.getElementById("totalWinnings").textContent = `$${totalWinnings.toFixed(2)}`;
  document.getElementById("winRate").textContent = `${winRate.toFixed(1)}%`;
}

function renderBetsTable(bets) {
  const tableBody = document.getElementById("betsTableBody");
  tableBody.innerHTML = "";

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
