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
let unsubscribeHistory = null;

/* ------------------------------------
3. Auth State
------------------------------------ */
auth.onAuthStateChanged(user => {

  if (!user) {
    window.location.href = "login.html?next=index.html";
    return;
  }

  if (userInfo) {
    userInfo.innerText = "Logged in: " + user.email;
  }
  if (authStatus) {
    authStatus.innerText = "Logged in: " + user.email;
  }

  startBetHistoryTracking(user.uid);

});

/* ------------------------------------
4. Logout
------------------------------------ */

if (logoutBtn) {

  logoutBtn.addEventListener("click", () => {

    auth.signOut().then(() => {
      if (typeof unsubscribeHistory === "function") {
        unsubscribeHistory();
        unsubscribeHistory = null;
      }
      window.location.href = "login.html?next=index.html";
    });

  });

}

/* ------------------------------------
5. Odds Calculator (improved)
------------------------------------ */

const MIN_BET_AMOUNT = 0.5;
const EVEN_ODDS_TERMS = new Set(["EVEN", "EVENS", "EVS"]);
const BET_TYPE_CONFIG = {
  win: { legs: 1, profitFactor: 1 },
  place: { legs: 1, profitFactor: 0.65 },
  show: { legs: 1, profitFactor: 0.45 },
  exacta: { legs: 2, profitFactor: 1 },
  exacta_box: { legs: 2, profitFactor: 0.9 },
  trifecta: { legs: 3, profitFactor: 1 },
  trifecta_key: { legs: 3, profitFactor: 0.95 },
  superfecta: { legs: 4, profitFactor: 1 },
  pick3: { legs: 3, profitFactor: 1 },
  pick4: { legs: 4, profitFactor: 1 },
  pick5: { legs: 5, profitFactor: 1 },
  pick6: { legs: 6, profitFactor: 1 },
};
const LIVE_ODDS_SPORT_KEY = "racing_horse";
const LIVE_ODDS_API_ROOT = "https://api.the-odds-api.com/v4/sports";
const LIVE_ODDS_KEY_STORAGE = "live_odds_api_key";
const PAYOUT_API_URL_STORAGE = "payout_api_url";
const PAYOUT_API_TOKEN_STORAGE = "payout_api_token";

function setResultMessage(message) {
  resultDiv.innerText = message;
}

function normalizeOddsInput(oddsStr) {
  if (typeof oddsStr !== "string") return "";
  return oddsStr.replaceAll(",", "").trim().toUpperCase();
}

function getBetFormValues() {
  const raceRaw = raceInput?.value;
  return {
    trackName: (trackInput?.value || "").trim(),
    horseName: (horseInput?.value || "").trim(),
    raceNumber: parseInt(raceRaw, 10),
    betType: betMode?.value || "",
    betAmount: parseFloat(betAmountInput?.value),
    odds: (oddsInput?.value || "").trim(),
    winner: Boolean(isWinnerCheckbox?.checked),
  };
}

function isValidBetAmount(amount) {
  return Number.isFinite(amount) && amount >= MIN_BET_AMOUNT;
}

async function runWithButtonDisabled(button, task) {
  button.disabled = true;
  try {
    await task();
  } finally {
    button.disabled = false;
  }
}

function parseOddsToDecimalMultiplier(oddsStr) {
  const normalizedOdds = normalizeOddsInput(oddsStr);
  if (!normalizedOdds) return null;

  // Special case: "EVEN"/"EVENS"/"EVS" = 1/1 => decimal multiplier 2.0
  if (EVEN_ODDS_TERMS.has(normalizedOdds)) {
    return 2;
  }

  // Fractional odds: "A/B" => decimal multiplier = 1 + A/B
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

    return 1 + num / den;
  }

  // American odds: "+150" or "-200" (integer and |n| >= 100) => decimal multiplier
  if (/^[+-]\d+$/.test(normalizedOdds)) {
    const n = Number(normalizedOdds);
    if (!Number.isFinite(n) || Math.abs(n) < 100) return null;

    if (n > 0) {
      return 1 + n / 100;
    }

    return 1 + 100 / Math.abs(n);
  }

  // Decimal odds: e.g., "3.5"
  if (/^\d+(?:\.\d+)?$/.test(normalizedOdds)) {
    const maybeDecimal = Number(normalizedOdds);
    if (!Number.isFinite(maybeDecimal) || maybeDecimal <= 1) return null;
    return maybeDecimal;
  }

  return null;
}

function isSupportedBetType(betType) {
  return Object.prototype.hasOwnProperty.call(BET_TYPE_CONFIG, betType);
}

// calculateOdds returns total return including stake, adjusted by bet type profile.
function calculateOdds(betAmount, oddsStr, betType = "win") {
  if (
    typeof betAmount !== "number" ||
    !Number.isFinite(betAmount) ||
    betAmount < MIN_BET_AMOUNT
  ) {
    return null;
  }

  if (!isSupportedBetType(betType)) {
    return null;
  }

  const decimalMultiplier = parseOddsToDecimalMultiplier(oddsStr);
  if (!decimalMultiplier) return null;

  const { legs, profitFactor } = BET_TYPE_CONFIG[betType];
  const adjustedSingleLegMultiplier = 1 + (decimalMultiplier - 1) * profitFactor;
  const totalMultiplier = Math.pow(adjustedSingleLegMultiplier, legs);

  if (!Number.isFinite(totalMultiplier) || totalMultiplier <= 0) return null;
  return betAmount * totalMultiplier;
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

    const { betAmount, odds, betType } = getBetFormValues();

    if (!isValidBetAmount(betAmount)) {
      setResultMessage("Enter a valid bet amount (minimum $0.50).");
      return;
    }

    if (!odds) {
      setResultMessage("Enter odds (fractional A/B, decimal D, or American +N/-N).");
      return;
    }

    if (!isSupportedBetType(betType)) {
      setResultMessage("Unsupported bet type selected.");
      return;
    }

    const payout = calculateOdds(betAmount, odds, betType);

    if (payout === null) {
      setResultMessage("Unsupported odds or bet type. Use valid odds format and bet mode.");
      return;
    }

    calculatedPayout = payout;

    setResultMessage("Potential Payout: $" + calculatedPayout.toFixed(2));

  });

}

if (fetchPayoutApiBtn) {
  fetchPayoutApiBtn.addEventListener("click", async () => {
    const { betAmount, odds, trackName, horseName, raceNumber, betType } = getBetFormValues();

    if (!isValidBetAmount(betAmount)) {
      setResultMessage("Enter a valid bet amount (minimum $0.50).");
      return;
    }

    if (!odds) {
      setResultMessage("Enter odds before API payout calculation.");
      return;
    }

    if (!isSupportedBetType(betType)) {
      setResultMessage("Unsupported bet type selected.");
      return;
    }

    setResultMessage("Calculating payout via API...");

    await runWithButtonDisabled(fetchPayoutApiBtn, async () => {
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
        setResultMessage(`API Payout: $${calculatedPayout.toFixed(2)}`);
      } catch (error) {
        console.error(error);
        setResultMessage(error.message || "Unable to calculate payout via API.");
      }
    });
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

    const { trackName, horseName, raceNumber, betType, betAmount, odds, winner } = getBetFormValues();

    if (
      !trackName ||
      !horseName ||
      !Number.isInteger(raceNumber) ||
      raceNumber <= 0 ||
      !Number.isFinite(betAmount) ||
      betAmount < MIN_BET_AMOUNT ||
      !odds ||
      !isSupportedBetType(betType)
    ) {

      alert("Fill all required fields with valid values (race number > 0, minimum bet $0.50, supported bet type).");

      return;
    }

    const payout = calculateOdds(betAmount, odds, betType);

    if (payout === null) {
      alert("Unsupported odds format or bet mode. Use fractional (A/B), decimal (D), or American (+N/-N).");
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

        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now()

      });

      setResultMessage("Bet saved.");

      loadBetHistory();

    } catch (error) {

      console.error(error);

      setResultMessage("Error saving bet.");

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
      .limit(50)
      .get();
    const bets = [];
    snapshot.forEach((doc) => bets.push(doc.data()));
    renderBetHistory(bets);

  } catch (error) {

    console.error(error);

    historySection.innerHTML = "Error loading history.";

  }

}

function getBetSortTime(bet) {
  if (typeof bet.createdAtMs === "number" && Number.isFinite(bet.createdAtMs)) {
    return bet.createdAtMs;
  }

  if (bet.timestamp && typeof bet.timestamp.toDate === "function") {
    return bet.timestamp.toDate().getTime();
  }

  return 0;
}

function formatBetTime(bet) {
  const ms = getBetSortTime(bet);
  if (!ms) return "Time pending";
  return new Date(ms).toLocaleString();
}

function renderBetHistory(bets) {
  if (!bets || !bets.length) {
    historySection.innerHTML = "No bets yet.";
    return;
  }

  const sorted = [...bets]
    .sort((a, b) => getBetSortTime(b) - getBetSortTime(a))
    .slice(0, 10);

  let html = "";
  sorted.forEach((bet) => {
    html += `
      <div class=\"bet-row\">
        <strong>${bet.trackName || "Unknown Track"}</strong>
        Race ${bet.raceNumber || "—"}
        <br>

        Horse: ${bet.horseName || "—"}
        <br>

        Bet: $${Number(bet.betAmount || 0).toFixed(2)}
        Odds: ${bet.odds || "—"}
        <br>

        Outcome: ${bet.outcome || "pending"}
        <br>

        Winnings: $${Number(bet.winnings || 0).toFixed(2)}
        <br>

        Time: ${formatBetTime(bet)}
      </div>
      <hr>
    `;
  });

  historySection.innerHTML = html;
}

function startBetHistoryTracking(userId) {
  if (!userId) return;

  if (typeof unsubscribeHistory === "function") {
    unsubscribeHistory();
  }

  historySection.innerHTML = "Tracking live bet history...";

  unsubscribeHistory = db
    .collection("bets")
    .where("userId", "==", userId)
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        const bets = [];
        snapshot.forEach((doc) => bets.push(doc.data()));
        renderBetHistory(bets);
      },
      (error) => {
        console.error(error);
        historySection.innerHTML = "Error tracking history. Tap Load Bet History to retry.";
      }
    );
}

/* ------------------------------------
9. Share Bet Link
------------------------------------ */

if (shareBtn) {

  shareBtn.addEventListener("click", () => {

    const { trackName: track, horseName: horse, odds } = getBetFormValues();

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
    const { horseName, betAmount, betType } = getBetFormValues();

    if (!horseName) {
      setResultMessage("Enter a horse name first to fetch live odds.");
      return;
    }

    setResultMessage("Fetching live odds...");

    await runWithButtonDisabled(fetchPayoutBtn, async () => {
      try {
        const liveOdds = await fetchLiveOddsForHorse(horseName);
        oddsInput.value = String(liveOdds.decimalPrice.toFixed(2));

        if (isValidBetAmount(betAmount) && isSupportedBetType(betType)) {
          const payout = calculateOdds(betAmount, oddsInput.value, betType);
          if (payout !== null) {
            calculatedPayout = payout;
            setResultMessage(
              `Live odds loaded (${liveOdds.bookmakerName}): ${oddsInput.value}. ` +
              `Potential Payout: $${calculatedPayout.toFixed(2)}`
            );
            return;
          }
        }

        setResultMessage(
          `Live odds loaded (${liveOdds.bookmakerName}): ${oddsInput.value}. Click Calculate for payout.`
        );
      } catch (error) {
        console.error(error);
        setResultMessage(error.message || "Unable to fetch live odds.");
      }
    });
  });
}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", () => {
    loadBetHistory();
  });
}
