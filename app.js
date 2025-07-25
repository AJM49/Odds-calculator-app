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
  const betType = document.getElementById("betMode").value;
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsInput = document.getElementById("oddsInput").value;
  const resultDiv = document.getElementById("result");

  if (!betAmount || !oddsInput.includes("/")) {
    resultDiv.innerHTML = "Enter a valid bet amount and odds (e.g. 5/2)";
    return;
  }

  const [num, denom] = oddsInput.split("/").map(Number);
  const odds = num / denom;

  let multiplier = 1;
  if (betType === "exacta") multiplier = 2;
  else if (betType === "trifecta") multiplier = 3;
  else if (betType === "superfecta") multiplier = 4;

  const profit = betAmount * odds * multiplier;
  const total = betAmount + profit;

  resultDiv.innerHTML = `Profit: $${profit.toFixed(2)}<br>Total Return: $${total.toFixed(2)}`;

  if (auth.currentUser) {
    db.collection("bets").add({
      user: auth.currentUser.email,
      betType,
      betAmount,
      odds: oddsInput,
      profit: profit.toFixed(2),
      total: total.toFixed(2),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
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
