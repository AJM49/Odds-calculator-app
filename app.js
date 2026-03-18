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
const fetchPayoutApiBtn = document.getElementById("fetchPayoutApiBtn");
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
const LIVE_ODDS_SPORT_KEY = "racing_horse";
const LIVE_ODDS_API_ROOT = "https://api.the-odds-api.com/v4/sports";
const LIVE_ODDS_KEY_STORAGE = "live_odds_api_key";
const PAYOUT_API_URL_STORAGE = "payout_api_url";
const PAYOUT_API_TOKEN_STORAGE = "payout_api_token";

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

function promptForPayoutApiConfig() {
  const existingUrl = localStorage.getItem(PAYOUT_API_URL_STORAGE) || "";
  const existingToken = localStorage.getItem(PAYOUT_API_TOKEN_STORAGE) || "";

  const apiUrlInput = window.prompt(
    "Enter payout API URL (POST endpoint). Example: https://api.example.com/payout",
    existingUrl
  );

  if (!apiUrlInput || !apiUrlInput.trim()) return null;
  const apiUrl = apiUrlInput.trim();

  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("Invalid payout API URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Payout API URL must start with http:// or https://.");
  }

  const tokenInput = window.prompt(
    "Optional bearer token for payout API (leave blank if not required).",
    existingToken
  );
  const token = (tokenInput || "").trim();

  localStorage.setItem(PAYOUT_API_URL_STORAGE, apiUrl);
  if (token) {
    localStorage.setItem(PAYOUT_API_TOKEN_STORAGE, token);
  } else {
    localStorage.removeItem(PAYOUT_API_TOKEN_STORAGE);
  }

  return { apiUrl, token };
}

function getPayoutApiConfig() {
  const apiUrl = localStorage.getItem(PAYOUT_API_URL_STORAGE) || "";
  const token = localStorage.getItem(PAYOUT_API_TOKEN_STORAGE) || "";
  return { apiUrl, token };
}

function parsePayoutFromApiResponse(payload) {
  const candidates = [
    payload?.payout,
    payload?.totalReturn,
    payload?.data?.payout,
    payload?.data?.totalReturn
  ];

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num >= 0) {
      return num;
    }
  }

  return null;
}

async function fetchPayoutFromApi(input) {
  let { apiUrl, token } = getPayoutApiConfig();
  if (!apiUrl) {
    const prompted = promptForPayoutApiConfig();
    if (!prompted) {
      throw new Error("Payout API URL is required.");
    }
    apiUrl = prompted.apiUrl;
    token = prompted.token;
  }

  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Payout API request failed (${response.status}).`);
  }

  const payload = await response.json();
  const payout = parsePayoutFromApiResponse(payload);
  if (payout === null) {
    throw new Error("Payout API response missing numeric payout.");
  }

  return { payout, payload };
}

function promptForLiveOddsApiKey() {
  const existing = localStorage.getItem(LIVE_ODDS_KEY_STORAGE) || "";
  const input = window.prompt(
    "Enter your The Odds API key (stored in this browser only).",
    existing
  );

  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  localStorage.setItem(LIVE_ODDS_KEY_STORAGE, trimmed);
  return trimmed;
}

function getLiveOddsApiKey() {
  return localStorage.getItem(LIVE_ODDS_KEY_STORAGE) || "";
}

function parseOutcomePrice(outcome) {
  const rawPrice = outcome?.price;
  const n = Number(rawPrice);
  return Number.isFinite(n) ? n : null;
}

function findBestDecimalPrice(events, horseName) {
  const target = horseName.trim().toLowerCase();
  if (!target) return null;

  let best = null;
  let matchedEvent = null;
  let matchedBookmaker = null;

  for (const event of events || []) {
    for (const bookmaker of event?.bookmakers || []) {
      for (const market of bookmaker?.markets || []) {
        for (const outcome of market?.outcomes || []) {
          if ((outcome?.name || "").trim().toLowerCase() !== target) continue;

          const decimalPrice = parseOutcomePrice(outcome);
          if (!decimalPrice || decimalPrice <= 1) continue;

          if (best === null || decimalPrice > best) {
            best = decimalPrice;
            matchedEvent = event;
            matchedBookmaker = bookmaker;
          }
        }
      }
    }
  }

  if (best === null) return null;

  return {
    decimalPrice: best,
    eventName: matchedEvent?.home_team && matchedEvent?.away_team
      ? `${matchedEvent.home_team} vs ${matchedEvent.away_team}`
      : matchedEvent?.commence_time || "Unknown event",
    bookmakerName: matchedBookmaker?.title || "Unknown bookmaker"
  };
}

async function fetchLiveOddsForHorse(horseName) {
  let apiKey = getLiveOddsApiKey();
  if (!apiKey) {
    apiKey = promptForLiveOddsApiKey();
  }
  if (!apiKey) {
    throw new Error("Live odds API key is required.");
  }

  const url = new URL(`${LIVE_ODDS_API_ROOT}/${LIVE_ODDS_SPORT_KEY}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(LIVE_ODDS_KEY_STORAGE);
      throw new Error("Invalid API key. Please retry and enter a valid key.");
    }
    throw new Error(`Live odds request failed (${response.status}).`);
  }

  const events = await response.json();
  const bestPrice = findBestDecimalPrice(events, horseName);
  if (!bestPrice) {
    throw new Error(`No live odds found for "${horseName}".`);
  }

  return bestPrice;
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

if (fetchPayoutApiBtn) {
  fetchPayoutApiBtn.addEventListener("click", async () => {
    const betAmount = parseFloat(betAmountInput.value);
    const odds = oddsInput.value.trim();
    const trackName = (trackInput?.value || "").trim();
    const horseName = (horseInput?.value || "").trim();
    const raceNumber = parseInt((raceInput?.value || "").trim(), 10);
    const betType = betMode.value;

    if (!Number.isFinite(betAmount) || betAmount < MIN_BET_AMOUNT) {
      resultDiv.innerText = "Enter a valid bet amount (minimum $0.50).";
      return;
    }

    if (!odds) {
      resultDiv.innerText = "Enter odds before API payout calculation.";
      return;
    }

    fetchPayoutApiBtn.disabled = true;
    resultDiv.innerText = "Calculating payout via API...";

    try {
      const response = await fetchPayoutFromApi({
        betAmount,
        odds,
        betType,
        trackName,
        horseName,
        raceNumber: Number.isInteger(raceNumber) ? raceNumber : null
      });

      calculatedPayout = response.payout;
      resultDiv.innerText = `API Payout: $${calculatedPayout.toFixed(2)}`;
    } catch (error) {
      console.error(error);
      resultDiv.innerText = error.message || "Unable to calculate payout via API.";
    } finally {
      fetchPayoutApiBtn.disabled = false;
    }
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
  fetchPayoutBtn.addEventListener("click", async () => {
    const horseName = (horseInput?.value || "").trim();
    const betAmount = parseFloat(betAmountInput.value);

    if (!horseName) {
      resultDiv.innerText = "Enter a horse name first to fetch live odds.";
      return;
    }

    fetchPayoutBtn.disabled = true;
    resultDiv.innerText = "Fetching live odds...";

    try {
      const liveOdds = await fetchLiveOddsForHorse(horseName);
      oddsInput.value = String(liveOdds.decimalPrice.toFixed(2));

      if (Number.isFinite(betAmount) && betAmount >= MIN_BET_AMOUNT) {
        const payout = calculateOdds(betAmount, oddsInput.value);
        if (payout !== null) {
          calculatedPayout = payout;
          resultDiv.innerText =
            `Live odds loaded (${liveOdds.bookmakerName}): ${oddsInput.value}. ` +
            `Potential Payout: $${calculatedPayout.toFixed(2)}`;
          return;
        }
      }

      resultDiv.innerText =
        `Live odds loaded (${liveOdds.bookmakerName}): ${oddsInput.value}. Click Calculate for payout.`;
    } catch (error) {
      console.error(error);
      resultDiv.innerText = error.message || "Unable to fetch live odds.";
    } finally {
      fetchPayoutBtn.disabled = false;
    }
  });
}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", () => {
    loadBetHistory();
  });
}
