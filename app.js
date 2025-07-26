// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Authentication
function signUp() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(user => {
      alert("✅ Signed up!");
      sendVerificationEmail();
    })
    .catch(error => alert("❌ " + error.message));
}

function signIn() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(user => {
      document.getElementById("authStatus").innerText = "🔓 Logged in as " + email;
    })
    .catch(error => alert("❌ " + error.message));
}

function signOut() {
  auth.signOut()
    .then(() => {
      document.getElementById("authStatus").innerText = "🔒 Logged out";
    })
    .catch(error => alert("❌ " + error.message));
}

function sendVerificationEmail() {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    user.sendEmailVerification()
      .then(() => alert("📩 Verification email sent."))
      .catch(error => alert("❌ " + error.message));
  }
}

function sendResetEmail() {
  const email = document.getElementById("email").value;
  auth.sendPasswordResetEmail(email)
    .then(() => alert("📨 Password reset email sent."))
    .catch(error => alert("❌ " + error.message));
}

// Calculate Odds
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
  switch (betType) {
    case "exacta": multiplier = 2; break;
    case "exacta_box": multiplier = 4; break;
    case "trifecta": multiplier = 3; break;
    case "trifecta_key": multiplier = 6; break;
    case "superfecta": multiplier = 4; break;
    case "pick3": multiplier = 3; break;
    case "pick4": multiplier = 4; break;
    case "pick5": multiplier = 5; break;
    case "pick6": multiplier = 6; break;
  }

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

// Share Link
document.getElementById('shareBtn').addEventListener('click', () => {
  const bet = document.getElementById('betMode').value;
  const amount = document.getElementById('betAmount').value;
  const odds = document.getElementById('oddsInput').value;
  const shareURL = \`\${window.location.origin}\${window.location.pathname}?bet=\${bet}&amount=\${amount}&odds=\${odds}\`;
  navigator.clipboard.writeText(shareURL)
    .then(() => alert('✅ Link copied to clipboard!'))
    .catch(() => alert('🔗 Here is your link:\n' + shareURL));
});

// Restore from shared link
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('bet')) document.getElementById('betMode').value = params.get('bet');
  if (params.has('amount')) document.getElementById('betAmount').value = params.get('amount');
  if (params.has('odds')) document.getElementById('oddsInput').value = params.get('odds');
  if (params.get('bet') && params.get('amount') && params.get('odds')) {
    calculateOdds();
  }
});

// Mock Payout Fetch
function fetchPayoutDataFromInputs() {
  const track = document.getElementById('trackInput').value;
  const date = document.getElementById('raceDate').value;
  const mockOdds = "9/2";
  document.getElementById('oddsInput').value = mockOdds;
  alert(\`📡 Mock odds loaded for \${track} on \${date}: \${mockOdds}\`);
}

// Firestore: Save Bet
function logBetToFirestore(bet) {
  const user = auth.currentUser;
  if (user) {
    db.collection("users").doc(user.uid).collection("bets").add(bet)
      .then(() => console.log("✅ Bet logged"))
      .catch(err => console.error("❌ Failed to log bet", err));
  }
}

// Firestore: Load Bet History
function loadBetHistory() {
  const user = auth.currentUser;
  const historyDiv = document.getElementById("historySection");
  historyDiv.innerHTML = "🔄 Loading...";
  if (!user) {
    historyDiv.innerHTML = "⚠️ You must be signed in to view history.";
    return;
  }

  db.collection("users").doc(user.uid).collection("bets").orderBy("date", "desc").limit(10).get()
    .then(snapshot => {
      if (snapshot.empty) {
        historyDiv.innerHTML = "📭 No bet history found.";
        return;
      }
      let html = "<ul>";
      snapshot.forEach(doc => {
        const b = doc.data();
        html += \`<li>\${b.date.slice(0,10)} | Type: \${b.type}, Amount: \$\${b.amount}, Odds: \${b.odds}</li>\`;
      });
      html += "</ul>";
      historyDiv.innerHTML = html;
    })
    .catch(err => {
      historyDiv.innerHTML = "❌ Failed to load history.";
      console.error(err);
    });
}
