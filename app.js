/****************************************************
 HORSE ODDS CALCULATOR
 Frontend Input + Firestore Database Storage
****************************************************/

/* ------------------------------------
1. Firebase Configuration
------------------------------------ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* ------------------------------------
2. DOM Elements
------------------------------------ */

const calculateBtn = document.getElementById("calculateBtn");
const submitBetBtn = document.getElementById("submitBetBtn");
const shareBtn = document.getElementById("shareBtn");

const trackInput = document.getElementById("trackName");
const horseInput = document.getElementById("horseName");
const raceInput = document.getElementById("raceNumber");

const betMode = document.getElementById("betMode");
const betAmountInput = document.getElementById("betAmount");
const oddsInput = document.getElementById("oddsInput");

const isWinnerCheckbox = document.getElementById("isWinner");

const resultDiv = document.getElementById("result");
const historySection = document.getElementById("historySection");

const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

let calculatedPayout = 0;

/* ------------------------------------
3. Auth State
------------------------------------ */

auth.onAuthStateChanged(user => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  userInfo.innerText = "Logged in: " + user.email;

  loadBetHistory();

});

/* ------------------------------------
4. Logout
------------------------------------ */

if (logoutBtn) {

  logoutBtn.addEventListener("click", () => {

    auth.signOut().then(() => {
      window.location.href = "login.html";
    });

  });

}

/* ------------------------------------
5. Odds Calculator
------------------------------------ */

function calculateOdds(betAmount, odds) {

  const parts = odds.split("/");

  if (parts.length !== 2) {
    return 0;
  }

  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);

  if (denominator === 0) {
    return 0;
  }

  const payout = betAmount * (numerator / denominator);

  return payout + betAmount;
}

/* ------------------------------------
6. Calculate Button
------------------------------------ */

if (calculateBtn) {

  calculateBtn.addEventListener("click", () => {

    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();

    if (!betAmount || !odds) {

      resultDiv.innerText = "Enter bet amount and odds.";

      return;
    }

    calculatedPayout = calculateOdds(betAmount, odds);

    resultDiv.innerText =
      "Potential Payout: $" + calculatedPayout.toFixed(2);

  });

}

/* ------------------------------------
7. Save Bet to Firestore
------------------------------------ */

if (submitBetBtn) {

  submitBetBtn.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) {
      alert("You must log in.");
      return;
    }

    const trackName = trackInput.value.trim();
    const horseName = horseInput.value.trim();
    const raceNumber = parseInt(raceInput.value);

    const betType = betMode.value;
    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();

    const winner = isWinnerCheckbox.checked;

    if (!trackName || !horseName || !betAmount || !odds) {

      alert("Fill all required fields.");

      return;
    }

    const payout = calculateOdds(betAmount, odds);

    const winnings = winner ? payout : 0;

    const outcome = winner ? "win" : "lose";

    try {

      await db.collection("bets").add({

        userId: user.uid,

        trackName: trackName,
        horseName: horseName,
        raceNumber: raceNumber,

        betType: betType,

        betAmount: betAmount,
        odds: odds,

        payout: payout,
        winnings: winnings,

        outcome: outcome,

        timestamp: firebase.firestore.FieldValue.serverTimestamp()

      });

      resultDiv.innerText = "Bet saved.";

      loadBetHistory();

    } catch (error) {

      console.error(error);

      resultDiv.innerText = "Error saving bet.";

    }

  });

}

/* ------------------------------------
8. Load Bet History
------------------------------------ */

async function loadBetHistory() {

  const user = auth.currentUser;

  if (!user) {
    return;
  }

  historySection.innerHTML = "Loading...";

  try {

    const snapshot = await db
      .collection("bets")
      .where("userId", "==", user.uid)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    if (snapshot.empty) {

      historySection.innerHTML = "No bets yet.";

      return;

    }

    let html = "";

    snapshot.forEach(doc => {

      const bet = doc.data();

      html += `
      <div class="bet-row">
        <strong>${bet.trackName}</strong>
        Race ${bet.raceNumber}
        <br>

        Horse: ${bet.horseName}
        <br>

        Bet: $${bet.betAmount.toFixed(2)}
        Odds: ${bet.odds}
        <br>

        Outcome: ${bet.outcome}
        <br>

        Winnings: $${bet.winnings.toFixed(2)}
      </div>
      <hr>
      `;

    });

    historySection.innerHTML = html;

  } catch (error) {

    console.error(error);

    historySection.innerHTML = "Error loading history.";

  }

}

/* ------------------------------------
9. Share Bet Link
------------------------------------ */

if (shareBtn) {

  shareBtn.addEventListener("click", () => {

    const track = trackInput.value;
    const horse = horseInput.value;
    const odds = oddsInput.value;

    const text =
      "My bet: " +
      horse +
      " at " +
      track +
      " odds " +
      odds;

    navigator.clipboard.writeText(text);

    alert("Bet copied to clipboard.");

  });

}
