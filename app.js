const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

function signUp() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => alert("Signed up!"))
    .catch(error => alert(error.message));
}

function signIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => document.getElementById("authStatus").innerText = "Logged in as " + email)
    .catch(error => alert(error.message));
}

function signOut() {
  auth.signOut()
    .then(() => document.getElementById("authStatus").innerText = "Logged out")
    .catch(error => alert(error.message));
}

function calculateOdds() {
  const betType = document.getElementById('betMode').value;
  const betAmount = parseFloat(document.getElementById('betAmount').value);
  const oddsInput = document.getElementById('oddsInput').value;
  const resultDiv = document.getElementById('result');

  if (!betAmount || !oddsInput.includes('/')) {
    resultDiv.innerHTML = "❌ Enter a valid bet amount and odds (e.g. 5/2)";
    return;
  }

  const [num, denom] = oddsInput.split('/').map(Number);
  const decimalOdds = num / denom;

  // Multiplier adjustment per bet type
  const multiplierMap = {
    win: 1,
    place: 0.5,
    show: 0.33,
    exacta: 2,
    trifecta: 3,
    superfecta: 4
  };

  const multiplier = multiplierMap[betType] || 1;

  const grossProfit = betAmount * decimalOdds * multiplier;
  const totalReturn = betAmount + grossProfit;
  const breakEvenOdds = (1 / multiplier).toFixed(2);
  const profitOrLoss = grossProfit <= 0 ? '🔴 Loss' : '🟢 Profit';

  // Warning if low return
  const warning = (grossProfit < 0.5)
    ? "⚠️ Odds may be too low to profit from this wager."
    : "";

  resultDiv.innerHTML = `
    💸 Type: <b>${betType}</b><br>
    📊 Decimal Odds: <b>${decimalOdds.toFixed(2)}</b><br>
    💰 Gross Profit: <b>$${grossProfit.toFixed(2)}</b><br>
    💵 Total Return: <b>$${totalReturn.toFixed(2)}</b><br>
    📈 Break-even Odds: <b>${breakEvenOdds}</b><br>
    ✅ ${profitOrLoss}<br>
    ${warning}
  `;

  // Optional: log to Firestore
  if (typeof logBetToFirestore === 'function') {
    logBetToFirestore({
      betType,
      amount: betAmount,
      odds: oddsInput,
      profit: grossProfit.toFixed(2),
      total: totalReturn.toFixed(2),
      timestamp: new Date(),
    });
  }
}


document.getElementById("shareBtn").addEventListener("click", () => {
  const bet = document.getElementById("betMode").value;
  const amount = document.getElementById("betAmount").value;
  const odds = document.getElementById("oddsInput").value;
  const shareURL = `${window.location.origin}${window.location.pathname}?bet=${bet}&amount=${amount}&odds=${odds}`;
  navigator.clipboard.writeText(shareURL).then(() => alert("Link copied to clipboard!"));
});

function fetchPayoutDataFromInputs() {
  const track = document.getElementById("trackInput").value;
  const date = document.getElementById("raceDate").value;
  fetchPayoutData(track, date);
}

function fetchPayoutData(trackCode = 'BEL', date = '2025-07-24') {
  const mockOdds = "9/2";
  document.getElementById("oddsInput").value = mockOdds;
  alert(`Mock odds loaded for ${trackCode} on ${date}: ${mockOdds}`);
}
