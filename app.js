// Ensure Firebase SDK is imported before this script, e.g.:
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
// <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
};

// Initialize Firebase only if it hasn't been initialized already
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let messageTimeoutId; // To manage message display timeout

// Helper to display messages in the UI instead of alerts
function displayMessage(message, isError = false) {
  const messageDiv = document.getElementById("messageArea"); // Assume a div with this ID exists in your HTML
  if (messageDiv) {
    // Clear any existing timeout to prevent previous message from being prematurely cleared
    if (messageTimeoutId) {
      clearTimeout(messageTimeoutId);
    }
    messageDiv.innerText = message;
    messageDiv.style.color = isError ? "red" : "green";
    messageTimeoutId = setTimeout(() => {
      messageDiv.innerText = "";
      messageDiv.style.color = "";
      messageTimeoutId = null; // Clear the timeout ID
    }, 5000); // Clear message after 5 seconds
  } else {
    // Fallback to alert if messageArea doesn't exist (e.g., during development)
    alert(isError ? `❌ ${message}` : `✅ ${message}`);
  }
}

// Helper to get authentication input values
function getAuthInputs() {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  return { email, password, emailInput, passwordInput };
}

// Helper to manage visibility of auth controls
function updateAuthUI(user) {
  const authStatusDiv = document.getElementById("authStatus");
  const loggedInControlsDiv = document.getElementById("auth-logged-in"); // Assuming a div for logged in controls
  const loggedOutControlsDiv = document.getElementById("auth-logged-out"); // Assuming a div for logged out controls
  const historySectionDiv = document.getElementById("historySection");

  if (authStatusDiv) {
    if (user) {
      authStatusDiv.innerText = `🔓 Logged in as ${user.email} ${user.emailVerified ? '(Verified)' : '(Unverified)'}`;
      if (loggedInControlsDiv) loggedInControlsDiv.style.display = 'block';
      if (loggedOutControlsDiv) loggedOutControlsDiv.style.display = 'none';
      loadBetHistory(); // Load history when user logs in
    } else {
      authStatusDiv.innerText = "🔒 Logged out";
      if (loggedInControlsDiv) loggedInControlsDiv.style.display = 'none';
      if (loggedOutControlsDiv) loggedOutControlsDiv.style.display = 'block';
      if (historySectionDiv) historySectionDiv.innerHTML = "⚠️ You must be signed in to view history."; // Clear history if logged out
    }
  }
}

// Authentication state listener
auth.onAuthStateChanged(user => {
  updateAuthUI(user);
});


// Authentication
function signUp() {
  const { email, password } = getAuthInputs();

  if (!email || !password) {
    displayMessage("Email and password cannot be empty.", true);
    return;
  }
  // Basic email format check (Firebase will do more robust validation)
  // A more robust regex would be /^[^\s@]+@[^\s@]+\.[^\s@]+$/. This is for UX only.
  if (!email.includes("@") || !email.includes(".")) {
      displayMessage("Please enter a valid email address.", true);
      return;
  }
  // Password length requirement (Firebase default is 6 characters minimum)
  if (password.length < 6) {
      displayMessage("Password must be at least 6 characters long.", true);
      return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      displayMessage("Signed up successfully! Please verify your email.");
      // User is automatically signed in after sign-up
      sendVerificationEmail();
    })
    .catch(error => displayMessage(`Sign Up Failed: ${error.message}`, true));
}

function signIn() {
  const { email, password } = getAuthInputs();

  if (!email || !password) {
    displayMessage("Email and password cannot be empty.", true);
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      displayMessage("Successfully logged in!");
      // UI update handled by onAuthStateChanged listener
    })
    .catch(error => displayMessage(`Sign In Failed: ${error.message}`, true));
}

function signOut() {
  auth.signOut()
    .then(() => {
      displayMessage("Successfully logged out.");
      // UI update handled by onAuthStateChanged listener
    })
    .catch(error => displayMessage(`Sign Out Failed: ${error.message}`, true));
}

function sendVerificationEmail() {
  const user = auth.currentUser;
  if (user) {
    if (!user.emailVerified) {
      user.sendEmailVerification()
        .then(() => displayMessage("Verification email sent. Please check your inbox."))
        .catch(error => displayMessage(`Failed to send verification email: ${error.message}`, true));
    } else {
      displayMessage("Your email is already verified.");
    }
  } else {
    displayMessage("No user is currently signed in to send a verification email.", true);
  }
}

function sendResetEmail() {
  const { email } = getAuthInputs(); // Only email is needed for password reset

  if (!email) {
    displayMessage("Please enter your email to send a password reset link.", true);
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => displayMessage("Password reset email sent. Check your inbox."))
    .catch(error => displayMessage(`Failed to send password reset email: ${error.message}`, true));
}

// Odds multipliers configuration
const BET_TYPE_MULTIPLIERS = {
  "exacta": 2,
  "exacta_box": 4,
  "trifecta": 3,
  "trifecta_key": 6,
  "superfecta": 4,
  "pick3": 3,
  "pick4": 4,
  "pick5": 5,
  "pick6": 6
};

// Calculate Odds
function calculateOdds() {
  const betTypeInput = document.getElementById('betMode');
  const betAmountInput = document.getElementById('betAmount');
  const oddsInput = document.getElementById('oddsInput');
  const resultDiv = document.getElementById('result');

  // Input elements might not exist if HTML isn't fully loaded or incorrect IDs
  if (!betTypeInput || !betAmountInput || !oddsInput || !resultDiv) {
    displayMessage("Error: Missing required input elements for calculation.", true);
    return;
  }

  const betType = betTypeInput.value;
  const betAmount = parseFloat(betAmountInput.value);
  const oddsInputValue = oddsInput.value.trim();

  // Validate betAmount
  if (isNaN(betAmount) || betAmount <= 0) {
    resultDiv.textContent = "❌ Please enter a valid bet amount (a positive number)."; // Use textContent for safety
    return;
  }

  // Validate oddsInput format
  if (!oddsInputValue.includes('/') || oddsInputValue.split('/').length !== 2) {
    resultDiv.textContent = "❌ Please enter odds in the format 'num/denom' (e.g., 5/2)."; // Use textContent for safety
    return;
  }

  const [numStr, denomStr] = oddsInputValue.split('/');
  const num = Number(numStr);
  const denom = Number(denomStr);

  // Validate parsed odds components
  if (isNaN(num) || isNaN(denom) || num < 0 || denom < 0) {
      resultDiv.textContent = "❌ Odds must be valid positive numbers (e.g., 5/2). Don't include negative signs."; // Use textContent for safety
      return;
  }
  if (denom === 0) {
    resultDiv.textContent = "❌ Denominator of odds cannot be zero."; // Use textContent for safety
    return;
  }

  const odds = num / denom;

  const multiplier = BET_TYPE_MULTIPLIERS[betType] || 1; // Default to 1 if betType not found

  const profit = betAmount * odds * multiplier;
  const total = betAmount + profit;

  // Using template literals for safer text content, still assigning to innerHTML for formatting
  resultDiv.innerHTML = `💰 Profit: $${profit.toFixed(2)}<br>Total Return: $${total.toFixed(2)}`;

  logBetToFirestore({
    type: betType,
    amount: betAmount,
    odds: oddsInputValue
    // Removed 'date' field as 'timestamp' is preferred and more accurate.
  });
}

// Share Link
function shareBetLink() {
  const bet = document.getElementById('betMode')?.value;
  const amount = document.getElementById('betAmount')?.value;
  const odds = document.getElementById('oddsInput')?.value;

  if (!bet || !amount || !odds) {
    displayMessage("Please fill in all bet details (Type, Amount, Odds) to generate a share link.", true);
    return;
  }

  const shareURL = `${window.location.origin}${window.location.pathname}?bet=${encodeURIComponent(bet)}&amount=${encodeURIComponent(amount)}&odds=${encodeURIComponent(odds)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareURL)
      .then(() => displayMessage('Link copied to clipboard!'))
      .catch(err => {
        console.error("Failed to copy link:", err);
        displayMessage('Failed to copy link. Here is your link: ' + shareURL, true);
      });
  } else {
    // Fallback for browsers that don't support Clipboard API
    displayMessage('Your browser does not support automatic clipboard copy. Here is your link: ' + shareURL, true);
  }
}

// Mock Payout Fetch
function fetchPayoutDataFromInputs() {
  const trackInput = document.getElementById('trackInput');
  const raceDateInput = document.getElementById('raceDate');
  const oddsInput = document.getElementById('oddsInput');

  if (!trackInput || !raceDateInput || !oddsInput) {
    displayMessage("Error: Missing track, date, or odds input elements.", true);
    return;
  }

  const track = trackInput.value.trim();
  const date = raceDateInput.value;
  const mockOdds = "9/2"; // This should ideally come from an actual API call

  if (!track || !date) {
    displayMessage("Please enter both track and race date for mock odds.", true);
    return;
  }

  oddsInput.value = mockOdds;
  displayMessage(`Mock odds loaded for ${track} on ${date}: ${mockOdds}`);
}

// Firestore: Save Bet
// IMPORTANT: Ensure you have Firebase Security Rules configured for 'users/{uid}/bets' collection
// Example Rule: allow read, write: if request.auth.uid == userId;
function logBetToFirestore(bet) {
  const user = auth.currentUser;
  if (user) {
    db.collection("users").doc(user.uid).collection("bets").add({
        ...bet,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp for accuracy
    })
      .then(() => console.log("✅ Bet logged to Firestore"))
      .catch(err => {
        console.error("❌ Failed to log bet to Firestore:", err);
        displayMessage("Failed to save bet history.", true);
      });
  } else {
    console.warn("User not logged in, cannot log bet to Firestore.");
    displayMessage("You must be logged in to save bets.", true);
  }
}

// Firestore: Load Bet History
function loadBetHistory() {
  const user = auth.currentUser;
  const historyDiv = document.getElementById("historySection");

  if (!historyDiv) {
    console.error("Error: historySection element not found.");
    return;
  }

  historyDiv.innerHTML = "🔄 Loading bet history...";
  if (!user) {
    historyDiv.innerHTML = "⚠️ You must be signed in to view history.";
    return;
  }

  db.collection("users").doc(user.uid).collection("bets").orderBy("timestamp", "desc").limit(10).get() // Order by server timestamp
    .then(snapshot => {
      if (snapshot.empty) {
        historyDiv.innerHTML = "📭 No bet history found.";
        return;
      }
      let html = "<h3>Your Recent Bets:</h3><ul>";
      snapshot.forEach(doc => {
        const b = doc.data();
        // Use timestamp first, fallback to 'N/A' if not present.
        // The original code had a 'date' fallback, but 'timestamp' should always be used now.
        const dateString = b.timestamp ? new Date(b.timestamp.toDate()).toLocaleDateString() : "N/A";

        // Use textContent for untrusted data to prevent XSS. For structured numbers, toFixed is fine.
        const type = b.type ? String(b.type) : 'N/A';
        const amount = typeof b.amount === 'number' ? b.amount.toFixed(2) : 'N/A';
        const odds = b.odds ? String(b.odds) : 'N/A';

        // Constructing HTML string. For complex UIs or highly untrusted input, consider a templating engine or safer DOM manipulation.
        html += `<li>${dateString} | Type: <span class="bet-type">${type}</span>, Amount: $<span class="bet-amount">${amount}</span>, Odds: <span class="bet-odds">${odds}</span></li>`;
      });
      html += "</ul>";
      historyDiv.innerHTML = html;
    })
    .catch(err => {
      historyDiv.innerHTML = "❌ Failed to load history.";
      console.error("Failed to load bet history:", err);
      displayMessage("Failed to load bet history.", true);
    });
}

// Attach event listeners after DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  // Cache frequently accessed elements
  const signUpBtn = document.getElementById('signUpBtn');
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const sendVerificationBtn = document.getElementById('sendVerificationBtn');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const calculateBtn = document.getElementById('calculateBtn');
  const shareBtn = document.getElementById('shareBtn');
  const fetchPayoutBtn = document.getElementById('fetchPayoutBtn');
  const loadHistoryBtn = document.getElementById('loadHistoryBtn');
  const betModeInput = document.getElementById('betMode');
  const betAmountInput = document.getElementById('betAmount');
  const oddsInput = document.getElementById('oddsInput');

  // Authentication Buttons
  if (signUpBtn) signUpBtn.addEventListener('click', signUp);
  if (signInBtn) signInBtn.addEventListener('click', signIn);
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);
  if (sendVerificationBtn) sendVerificationBtn.addEventListener('click', sendVerificationEmail);
  if (sendResetBtn) sendResetBtn.addEventListener('click', sendResetEmail);

  // Calculator Buttons
  if (calculateBtn) calculateBtn.addEventListener('click', calculateOdds);
  if (shareBtn) shareBtn.addEventListener('click', shareBetLink);
  if (fetchPayoutBtn) fetchPayoutBtn.addEventListener('click', fetchPayoutDataFromInputs);
  if (loadHistoryBtn) loadHistoryBtn.addEventListener('click', loadBetHistory);

  // Restore from shared link
  const params = new URLSearchParams(window.location.search);
  let paramsApplied = false;

  if (params.has('bet') && betModeInput) {
    const betType = params.get('bet');
    if (Object.keys(BET_TYPE_MULTIPLIERS).includes(betType)) {
        betModeInput.value = betType;
        paramsApplied = true;
    } else {
        console.warn(`Invalid bet type in URL: ${betType}`);
    }
  }
  if (params.has('amount') && betAmountInput) {
    const amount = parseFloat(params.get('amount'));
    if (!isNaN(amount) && amount > 0) {
      betAmountInput.value = amount;
      paramsApplied = true;
    } else {
      console.warn(`Invalid amount in URL: ${params.get('amount')}`);
    }
  }
  if (params.has('odds') && oddsInput) {
    const odds = params.get('odds');
    // Basic validation for odds format and numeric parts
    if (odds.includes('/') && odds.split('/').length === 2 && odds.split('/').every(s => !isNaN(Number(s)) && Number(s) >= 0)) {
      oddsInput.value = odds;
      paramsApplied = true;
    } else {
      console.warn(`Invalid odds in URL: ${odds}`);
    }
  }

  // Only calculate if all necessary params were successfully applied and elements exist
  if (paramsApplied && params.has('bet') && params.has('amount') && params.has('odds') && betModeInput && betAmountInput && oddsInput) {
    calculateOdds();
  }
});
