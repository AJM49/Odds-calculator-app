// Firebase imports
import { 
  getFirestore, collection, query, where, orderBy, onSnapshot 
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Initialize Firebase
const db = getFirestore();
const auth = getAuth();

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
}
