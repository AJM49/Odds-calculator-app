/****************************************************
 HORSE ODDS CALCULATOR
 Frontend Input + Firestore Database Storage
 ****************************************************/

import { auth, db } from './firebase.js';

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
const dynamicFields = document.getElementById("dynamicFields");
const oddsGroup = document.getElementById("oddsGroup");
const betAmountInput = document.getElementById("betAmount");
const oddsInput = document.getElementById("oddsInput");

const isWinnerCheckbox = document.getElementById("isWinner");

const resultDiv = document.getElementById("result");
const historySection = document.getElementById("historySection");

const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

let calculatedPayout = 0;

/* ------------------------------------
3. Update Form Fields
------------------------------------ */

function updateFormFields() {
  const mode = betMode.value;
  dynamicFields.innerHTML = '';

  // Common fields
  const trackGroup = document.createElement('div');
  trackGroup.className = 'form-group';
  trackGroup.innerHTML = `
    <label for="trackName">Track Name:</label>
    <input type="text" id="trackName" placeholder="Track Name" />
  `;
  dynamicFields.appendChild(trackGroup);

  const raceGroup = document.createElement('div');
  raceGroup.className = 'form-group';
  raceGroup.innerHTML = `
    <label for="raceNumber">Race Number:</label>
    <input type="number" id="raceNumber" placeholder="Race Number" min="1" />
  `;
  dynamicFields.appendChild(raceGroup);

  if (mode === 'win' || mode === 'place' || mode === 'show') {
    const horseGroup = document.createElement('div');
    horseGroup.className = 'form-group';
    horseGroup.innerHTML = `
      <label for="horseName">Horse Name:</label>
      <input type="text" id="horseName" placeholder="Horse Name" />
    `;
    dynamicFields.appendChild(horseGroup);
  } else if (mode === 'exacta' || mode === 'exacta_box') {
    const horse1Group = document.createElement('div');
    horse1Group.className = 'form-group';
    horse1Group.innerHTML = `
      <label for="horse1">Horse 1 (Win):</label>
      <input type="text" id="horse1" placeholder="Horse 1" />
    `;
    dynamicFields.appendChild(horse1Group);

    const horse2Group = document.createElement('div');
    horse2Group.className = 'form-group';
    horse2Group.innerHTML = `
      <label for="horse2">Horse 2 (Place):</label>
      <input type="text" id="horse2" placeholder="Horse 2" />
    `;
    dynamicFields.appendChild(horse2Group);
  } else if (mode === 'trifecta' || mode === 'trifecta_key') {
    const horse1Group = document.createElement('div');
    horse1Group.className = 'form-group';
    horse1Group.innerHTML = `
      <label for="horse1">Horse 1 (1st):</label>
      <input type="text" id="horse1" placeholder="Horse 1" />
    `;
    dynamicFields.appendChild(horse1Group);

    const horse2Group = document.createElement('div');
    horse2Group.className = 'form-group';
    horse2Group.innerHTML = `
      <label for="horse2">Horse 2 (2nd):</label>
      <input type="text" id="horse2" placeholder="Horse 2" />
    `;
    dynamicFields.appendChild(horse2Group);

    const horse3Group = document.createElement('div');
    horse3Group.className = 'form-group';
    horse3Group.innerHTML = `
      <label for="horse3">Horse 3 (3rd):</label>
      <input type="text" id="horse3" placeholder="Horse 3" />
    `;
    dynamicFields.appendChild(horse3Group);
  } else if (mode === 'superfecta') {
    const horse1Group = document.createElement('div');
    horse1Group.className = 'form-group';
    horse1Group.innerHTML = `
      <label for="horse1">Horse 1 (1st):</label>
      <input type="text" id="horse1" placeholder="Horse 1" />
    `;
    dynamicFields.appendChild(horse1Group);

    const horse2Group = document.createElement('div');
    horse2Group.className = 'form-group';
    horse2Group.innerHTML = `
      <label for="horse2">Horse 2 (2nd):</label>
      <input type="text" id="horse2" placeholder="Horse 2" />
    `;
    dynamicFields.appendChild(horse2Group);

    const horse3Group = document.createElement('div');
    horse3Group.className = 'form-group';
    horse3Group.innerHTML = `
      <label for="horse3">Horse 3 (3rd):</label>
      <input type="text" id="horse3" placeholder="Horse 3" />
    `;
    dynamicFields.appendChild(horse3Group);

    const horse4Group = document.createElement('div');
    horse4Group.className = 'form-group';
    horse4Group.innerHTML = `
      <label for="horse4">Horse 4 (4th):</label>
      <input type="text" id="horse4" placeholder="Horse 4" />
    `;
    dynamicFields.appendChild(horse4Group);
  } else if (mode.startsWith('pick')) {
    const num = parseInt(mode.slice(4));
    for (let i = 1; i <= num; i++) {
      const raceGroup = document.createElement('div');
      raceGroup.className = 'form-group';
      raceGroup.innerHTML = `
        <label for="pick${i}">Race ${i} Horse:</label>
        <input type="text" id="pick${i}" placeholder="Horse for Race ${i}" />
      `;
      dynamicFields.appendChild(raceGroup);
    }
  }

  // Odds group is always there
}

// Initialize
updateFormFields();
betMode.addEventListener('change', updateFormFields);

/* ------------------------------------
4. Auth State
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
5. Odds Calculator (improved)
------------------------------------ */

// calculateOdds returns the total return including stake, or null for invalid input.
function calculateOdds(betAmount, oddsStr) {
  // Validate bet amount
  if (typeof betAmount !== 'number' || isNaN(betAmount) || betAmount <= 0) {
    return null;
  }

  if (typeof oddsStr !== 'string' || !oddsStr.trim()) return null;

  const odds = oddsStr.trim();

  // Fractional odds: "A/B"
  if (odds.includes('/')) {
    const parts = odds.split('/');
    if (parts.length !== 2) return null;
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (isNaN(num) || isNaN(den) || den === 0) return null;
    const profit = betAmount * (num / den);
    return betAmount + profit;
  }

  // American odds: "+150" or "-200"
  if (/^[+-]\d+(?:\.\d+)?$/.test(odds)) {
    const n = parseFloat(odds);
    if (isNaN(n) || n === 0) return null;
    if (n > 0) {
      // +150 means $100 bet wins $150 -> profit = bet * (n/100)
      const profit = betAmount * (n / 100);
      return betAmount + profit;
    } else {
      // -200 means bet $200 to win $100 -> profit = bet * (100 / 200)
      const profit = betAmount * (100 / Math.abs(n));
      return betAmount + profit;
    }
  }

  // Decimal odds: e.g., "3.5" (total return including stake)
  const maybeDecimal = parseFloat(odds);
  if (!isNaN(maybeDecimal) && maybeDecimal > 0) {
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

    if (isNaN(betAmount) || betAmount <= 0) {
      resultDiv.innerText = "Enter a valid bet amount (> 0).";
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

    const trackName = document.getElementById("trackName")?.value.trim() || '';
    const raceNumber = parseInt(document.getElementById("raceNumber")?.value, 10) || 0;

    const betType = betMode.value;
    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();

    let horseName = '';
    if (betType === 'win' || betType === 'place' || betType === 'show') {
      horseName = document.getElementById("horseName")?.value.trim() || '';
    } else if (betType === 'exacta' || betType === 'exacta_box') {
      const h1 = document.getElementById("horse1")?.value.trim() || '';
      const h2 = document.getElementById("horse2")?.value.trim() || '';
      horseName = `${h1}-${h2}`;
    } else if (betType === 'trifecta' || betType === 'trifecta_key') {
      const h1 = document.getElementById("horse1")?.value.trim() || '';
      const h2 = document.getElementById("horse2")?.value.trim() || '';
      const h3 = document.getElementById("horse3")?.value.trim() || '';
      horseName = `${h1}-${h2}-${h3}`;
    } else if (betType === 'superfecta') {
      const h1 = document.getElementById("horse1")?.value.trim() || '';
      const h2 = document.getElementById("horse2")?.value.trim() || '';
      const h3 = document.getElementById("horse3")?.value.trim() || '';
      const h4 = document.getElementById("horse4")?.value.trim() || '';
      horseName = `${h1}-${h2}-${h3}-${h4}`;
    } else if (betType.startsWith('pick')) {
      const num = parseInt(betType.slice(4));
      const horses = [];
      for (let i = 1; i <= num; i++) {
        const h = document.getElementById(`pick${i}`)?.value.trim() || '';
        horses.push(h);
      }
      horseName = horses.join('-');
    }

    const winner = isWinnerCheckbox.checked;

    if (!trackName || !horseName || isNaN(betAmount) || betAmount <= 0 || !odds) {

      alert("Fill all required fields with valid values.");

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

      let horseDisplay = bet.horseName;
      if (bet.betType !== 'win' && bet.betType !== 'place' && bet.betType !== 'show') {
        horseDisplay = bet.horseName.split('-').join(' → ');
      }

      html += `
      <div class=\"bet-row\">
        <strong>${bet.trackName}</strong>
        Race ${bet.raceNumber}
        <br>

        Bet: ${bet.betType}
        <br>

        Horse(s): ${horseDisplay}
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

    const track = document.getElementById("trackName")?.value || '';
    const betType = betMode.value;
    let horse = '';
    if (betType === 'win' || betType === 'place' || betType === 'show') {
      horse = document.getElementById("horseName")?.value || '';
    } else if (betType === 'exacta' || betType === 'exacta_box') {
      const h1 = document.getElementById("horse1")?.value || '';
      const h2 = document.getElementById("horse2")?.value || '';
      horse = `${h1}-${h2}`;
    } else if (betType === 'trifecta' || betType === 'trifecta_key') {
      const h1 = document.getElementById("horse1")?.value || '';
      const h2 = document.getElementById("horse2")?.value || '';
      const h3 = document.getElementById("horse3")?.value || '';
      horse = `${h1}-${h2}-${h3}`;
    } else if (betType === 'superfecta') {
      const h1 = document.getElementById("horse1")?.value || '';
      const h2 = document.getElementById("horse2")?.value || '';
      const h3 = document.getElementById("horse3")?.value || '';
      const h4 = document.getElementById("horse4")?.value || '';
      horse = `${h1}-${h2}-${h3}-${h4}`;
    } else if (betType.startsWith('pick')) {
      const num = parseInt(betType.slice(4));
      const horses = [];
      for (let i = 1; i <= num; i++) {
        const h = document.getElementById(`pick${i}`)?.value || '';
        horses.push(h);
      }
      horse = horses.join('-');
    }
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
