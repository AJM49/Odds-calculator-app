/****************************************************
 HORSE ODDS CALCULATOR
 Frontend Input + Firestore Database Storage
 ****************************************************/

/* ------------------------------------
1. Firebase Configuration
------------------------------------ */

const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  storageBucket: "horse-bet-calculator.firebasestorage.app",
  messagingSenderId: "258212871291",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
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
const fetchPayoutBtn = document.getElementById("fetchPayoutBtn");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");

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
const authStatus = document.getElementById("authStatus");

let calculatedPayout = 0;

/* ------------------------------------
3. Auth State
------------------------------------ */
auth.onAuthStateChanged(user => {

  if (!user) {
    const nextPage = window.location.pathname.split("/").pop() || "index.html";
    window.location.href = `login.html?next=${encodeURIComponent(nextPage)}`;
    return;
  }

  if (userInfo) {
    userInfo.innerText = "Logged in: " + user.email;
  }
  if (authStatus) {
    authStatus.innerText = "Logged in: " + user.email;
  }

  loadBetHistory();

});

/* ------------------------------------
4. Logout
------------------------------------ */

if (logoutBtn) {

  logoutBtn.addEventListener("click", () => {

    auth.signOut().then(() => {
      window.location.href = "login.html?next=index.html";
    });

  });

}

/* ------------------------------------
5. Odds Calculator (improved)
------------------------------------ */

const MIN_BET_AMOUNT = 0.5;

// calculateOdds returns the total return including stake, or null for invalid input.
function calculateOdds(betAmount, oddsStr) {
  if (
    typeof betAmount !== "number" ||
    !Number.isFinite(betAmount) ||
    betAmount < MIN_BET_AMOUNT
  ) {
    return null;
  }

  if (typeof oddsStr !== "string" || !oddsStr.trim()) return null;

  const normalizedOdds = oddsStr.replaceAll(",", "").trim().toUpperCase();
  if (!normalizedOdds) return null;

  // Special case: "EVEN"/"EVENS"/"EVS" = 1/1
  if (normalizedOdds === "EVEN" || normalizedOdds === "EVENS" || normalizedOdds === "EVS") {
    return betAmount * 2;
  }

  // Fractional odds: "A/B"
  if (normalizedOdds.includes("/")) {
    const parts = normalizedOdds.split("/");
    if (parts.length !== 2) return null;

    const num = Number(parts[0].trim());
    const den = Number(parts[1].trim());

    if (
      !Number.isFinite(num) ||
      !Number.isFinite(den) ||
      num <= 0 ||
      den <= 0
    ) {
      return null;
    }

    const profit = betAmount * (num / den);
    return betAmount + profit;
  }

  // American odds: "+150" or "-200" (integer and |n| >= 100)
  if (/^[+-]\d+$/.test(normalizedOdds)) {
    const n = Number(normalizedOdds);
    if (!Number.isFinite(n) || Math.abs(n) < 100) return null;

    if (n > 0) {
      // +150 means $100 bet wins $150 -> profit = bet * (n/100)
      const profit = betAmount * (n / 100);
      return betAmount + profit;
    }

    // -200 means bet $200 to win $100 -> profit = bet * (100 / 200)
    const profit = betAmount * (100 / Math.abs(n));
    return betAmount + profit;
  }

  // Decimal odds: e.g., "3.5" (must be > 1.0 for a valid return)
  if (/^\d+(?:\.\d+)?$/.test(normalizedOdds)) {
    const maybeDecimal = Number(normalizedOdds);
    if (!Number.isFinite(maybeDecimal) || maybeDecimal <= 1) return null;
    return betAmount * maybeDecimal;
  }

  // Unsupported format
  return null;
}

/* ------------------------------------
6. Calculate Button
------------------------------------ */

if (calculateBtn) {

  calculateBtn.addEventListener("click", () => {

    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();

    if (!Number.isFinite(betAmount) || betAmount < MIN_BET_AMOUNT) {
      resultDiv.innerText = "Enter a valid bet amount (minimum $0.50).";
      return;
    }

    if (!odds) {
      resultDiv.innerText = "Enter odds (fractional A/B, decimal D, or American +N/-N).";
      return;
    }

    const payout = calculateOdds(betAmount, odds);

    if (payout === null) {
      resultDiv.innerText = "Unsupported odds format. Use fractional (A/B), decimal (D), or American (+N/-N).";
      return;
    }

    calculatedPayout = payout;

    resultDiv.innerText = "Potential Payout: $" + calculatedPayout.toFixed(2);

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
    const raceNumber = parseInt(raceInput.value, 10);

    const betType = betMode.value;
    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();

    const winner = isWinnerCheckbox.checked;

    if (
      !trackName ||
      !horseName ||
      !Number.isInteger(raceNumber) ||
      raceNumber <= 0 ||
      !Number.isFinite(betAmount) ||
      betAmount < MIN_BET_AMOUNT ||
      !odds
    ) {

      alert("Fill all required fields with valid values (race number > 0, minimum bet $0.50).");

      return;
    }

    const payout = calculateOdds(betAmount, odds);

    if (payout === null) {
      alert("Unsupported odds format. Use fractional (A/B), decimal (D), or American (+N/-N). [Example: 4/1 or 3.5 or +150]");
      return;
    }

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
      <div class=\"bet-row\">
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

    const track = trackInput ? trackInput.value : "";
    const horse = horseInput ? horseInput.value : "";
    const odds = oddsInput ? oddsInput.value : "";

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

if (fetchPayoutBtn) {
  fetchPayoutBtn.addEventListener("click", () => {
    resultDiv.innerText = "Mock live odds fetched. Entered odds kept as-is for local calculation.";
  });
}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", () => {
    loadBetHistory();
  });
}
