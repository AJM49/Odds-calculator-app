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
    .then(user => {
      alert("✅ Signed up!");
      auth.currentUser.sendEmailVerification()
        .then(() => alert("📧 Verification email sent. Please check your inbox."));
    })
    .catch(error => alert("❌ " + error.message));
}

function signIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(user => document.getElementById("authStatus").innerText = "🔓 Logged in as " + email)
    .catch(error => alert("❌ " + error.message));
}

function signOut() {
  auth.signOut()
    .then(() => document.getElementById("authStatus").innerText = "🔒 Logged out")
    .catch(error => alert("❌ " + error.message));
}

function sendResetEmail() {
  const email = document.getElementById("email").value;
  auth.sendPasswordResetEmail(email)
    .then(() => alert("📩 Password reset email sent."))
    .catch(err => alert("❌ " + err.message));
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
  const odds = num / denom;

  let multiplier = 1;
  if (betType === "exacta") multiplier = 2;
  else if (betType === "trifecta") multiplier = 3;
  else if (betType === "superfecta") multiplier = 4;

  const profit = betAmount * odds * multiplier;
  const total = betAmount + profit;

  resultDiv.innerHTML = `💰 Profit: $${profit.toFixed(2)}<br>Total Return: $${total.toFixed(2)}`;

  logBetToFirestore({
    type: betType,
    amount: betAmount,
    odds: oddsInput,
    date: new Date().toISOString()
  });
}

function logBetToFirestore(betData) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  db.collection("bets").doc(user.uid).collection("entries").add(betData)
    .then(() => console.log("✅ Bet saved"))
    .catch(err => console.error("❌ Error saving bet:", err));
}

function loadBetHistory() {
  const user = firebase.auth().currentUser;
  const historyDiv = document.getElementById("historySection");
  historyDiv.innerHTML = "<p>Loading history...</p>";

  if (!user) {
    historyDiv.innerHTML = "❌ You must be signed in.";
    return;
  }

  db.collection("bets").doc(user.uid).collection("entries")
    .orderBy("date", "desc")
    .limit(10)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        historyDiv.innerHTML = "<p>🕵️ No bets found.</p>";
        return;
      }
      let html = "<ul>";
      snapshot.forEach(doc => {
        const d = doc.data();
        html += `<li>${d.type} | $${d.amount} @ ${d.odds} | ${new Date(d.date).toLocaleString()}</li>`;
      });
      html += "</ul>";
      historyDiv.innerHTML = html;
    })
    .catch(err => {
      console.error("❌ Error fetching history:", err);
      historyDiv.innerHTML = "<p>Error loading history.</p>";
    });
}

document.getElementById('shareBtn').addEventListener('click', () => {
  const bet = document.getElementById('betMode').value;
  const amount = document.getElementById('betAmount').value;
  const odds = document.getElementById('oddsInput').value;
  const shareURL = `${window.location.origin}${window.location.pathname}?bet=${bet}&amount=${amount}&odds=${odds}`;
  navigator.clipboard.writeText(shareURL)
    .then(() => alert('✅ Link copied to clipboard!'))
    .catch(() => alert('🔗 Here is your link:\\n' + shareURL));
});

function fetchPayoutDataFromInputs() {
  const track = document.getElementById('trackInput').value;
  const date = document.getElementById('raceDate').value;
  const mockOdds = "9/2";
  document.getElementById('oddsInput').value = mockOdds;
  alert(`📡 Mock odds loaded for ${track} on ${date}: ${mockOdds}`);
}
