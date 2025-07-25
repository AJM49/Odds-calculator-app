// ✅ Firebase config - replace these with your Firebase project values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ✅ Authentication functions
function signUp() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => alert("✅ Signed up!"))
    .catch(error => alert("❌ " + error.message));
}

function signIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => document.getElementById("authStatus").innerText = "🔓 Logged in as " + email)
    .catch(error => alert("❌ " + error.message));
}

function signOut() {
  auth.signOut()
    .then(() => document.getElementById("authStatus").innerText = "🔒 Logged out")
    .catch(error => alert("❌ " + error.message));
}

// ✅ Pre-fill fields from shareable URL
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('bet')) document.getElementById('betMode').value = params.get('bet');
  if (params.has('amount')) document.getElementById('betAmount').value = params.get('amount');
  if (params.has('odds')) document.getElementById('oddsInput').value = params.get('odds');
  if (params.get('bet') && params.get('amount') && params.get('odds')) {
    calculateOdds();
  }
});

// ✅ Odds calculation with Firestore logging
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
  const odds = num / denom;

  let multiplier = 1;
  if (betType === "exacta") multiplier = 2;
  else if (betType === "trifecta") multiplier = 3;
  else if (betType === "superfecta") multiplier = 4;

  const profit = betAmount * odds * multiplier;
  const total = betAmount + profit;

  resultDiv.innerHTML = `💰 Profit: $${profit.toFixed(2)}<br>Total Return: $${total.toFixed(2)}`;

  // ✅ Log to Firestore if signed in
  if (auth.currentUser) {
    db.collection("bets").add({
      user: auth.currentUser.email,
      betType,
      betAmount,
      odds: oddsInput,
      profit: profit.toFixed(2),
      total: total.toFixed(2),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      console.log("✅ Bet logged to Firestore");
    }).catch((error) => {
      console.error("❌ Error logging bet:", error);
    });
  }
}

// ✅ Shareable bet link
document.getElementById('shareBtn').addEventListener('click', () => {
  const bet = document.getElementById('betMode').value;
  const amount = document.getElementById('betAmount').value;
  const odds = document.getElementById('oddsInput').value;
  const shareURL = `${window.location.origin}${window.location.pathname}?bet=${bet}&amount=${amount}&odds=${odds}`;
  navigator.clipboard.writeText(shareURL)
    .then(() => alert('✅ Link copied to clipboard!'))
    .catch(() => alert('🔗 Here is your link:\n' + shareURL));
});

// ✅ Manual fetch trigger from UI
function fetchPayoutDataFromInputs() {
  const track = document.getElementById('trackInput').value;
  const date = document.getElementById('raceDate').value;
  fetchPayoutData(track, date);
}

// ✅ Mock live odds fetch (can be replaced with real API)
async function fetchPayoutData(trackCode = 'BEL', date = '2025-07-24') {
  const mockOdds = "9/2";
  document.getElementById('oddsInput').value = mockOdds;
  alert(`📡 Mock odds loaded for ${trackCode} on ${date}: ${mockOdds}`);
}
