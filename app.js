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

  refreshBankrollDisplay();

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
      window.location.href = "login.html?next=index.html&loggedout=1";
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
const PAYOUT_API_URL_STORAGE = "payout_api_url";
const PAYOUT_API_TOKEN_STORAGE = "payout_api_token";
const MAX_BET_AMOUNT = 1_000_000;
const MAX_TEXT_INPUT_LENGTH = 80;
const MAX_RACE_NUMBER = 999;
const MAX_PAYOUT_CAP = 100_000_000;

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
  return (
    Number.isFinite(amount) &&
    amount >= MIN_BET_AMOUNT &&
    amount <= MAX_BET_AMOUNT
  );
}

async function runWithButtonDisabled(button, task) {
  button.disabled = true;
  try {
    await task();
  } finally {
    button.disabled = false;
  }
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function isValidTextInput(value) {
  const trimmed = sanitizeText(value);
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_INPUT_LENGTH;
}

function isValidRaceNumber(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_RACE_NUMBER;
}

function validateOddsInput(odds) {
  if (!sanitizeText(odds)) {
    return "Enter odds (fractional A/B, decimal D, or American +N/-N).";
  }
  if (sanitizeText(odds).length > 20) {
    return "Odds input is too long.";
  }
  if (parseOddsToDecimalMultiplier(odds) === null) {
    return "Unsupported odds format. Use fractional (A/B), decimal (D), or American (+N/-N).";
  }
  return null;
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
  const payout = betAmount * totalMultiplier;
  if (!Number.isFinite(payout) || payout <= 0 || payout > MAX_PAYOUT_CAP) return null;
  return payout;
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

/* ------------------------------------
6. Calculate Button
------------------------------------ */

if (calculateBtn) {

  calculateBtn.addEventListener("click", () => {

    const { betAmount, odds, betType } = getBetFormValues();

    if (!isValidBetAmount(betAmount)) {
      setResultMessage(`Enter a valid bet amount (minimum $0.50, maximum $${MAX_BET_AMOUNT.toLocaleString()}).`);
      return;
    }

    const oddsValidationError = validateOddsInput(odds);
    if (oddsValidationError) {
      setResultMessage(oddsValidationError);
      return;
    }

    if (!isSupportedBetType(betType)) {
      setResultMessage("Unsupported bet type selected.");
      return;
    }

    const payout = calculateOdds(betAmount, odds, betType);

    if (payout === null) {
      setResultMessage("Unsupported odds or bet type, or payout exceeds allowed range.");
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
      setResultMessage(`Enter a valid bet amount (minimum $0.50, maximum $${MAX_BET_AMOUNT.toLocaleString()}).`);
      return;
    }

    const oddsValidationError = validateOddsInput(odds);
    if (oddsValidationError) {
      setResultMessage(oddsValidationError);
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

    if (!isValidTextInput(trackName) || !isValidTextInput(horseName)) {
      alert(`Track and horse names are required (max ${MAX_TEXT_INPUT_LENGTH} characters).`);
      return;
    }

    if (!isValidRaceNumber(raceNumber)) {
      alert(`Race number must be an integer between 1 and ${MAX_RACE_NUMBER}.`);
      return;
    }

    if (!isValidBetAmount(betAmount)) {
      alert(`Bet amount must be between $${MIN_BET_AMOUNT.toFixed(2)} and $${MAX_BET_AMOUNT.toLocaleString()}.`);
      return;
    }

    const oddsValidationError = validateOddsInput(odds);
    if (oddsValidationError) {
      alert(oddsValidationError);
      return;
    }

    if (!isSupportedBetType(betType)) {
      alert("Unsupported bet type selected.");

      return;
    }

    const payout = calculateOdds(betAmount, odds, betType);

    if (payout === null) {
      alert("Invalid payout result. Check odds/bet type and try again.");
      return;
    }

    const winnings = winner ? payout : 0;

    const outcome = winner ? "win" : "pending";

    if (!BK) {
      setResultMessage("Bankroll helpers failed to load. Reload the page and try again.");
      return;
    }

    const betData = {

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
      // Phase 2-lite: false until Settle Bets confirms the real result.
      settled: false,

      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now()

    };

    try {

      // Atomically deducts the stake from the virtual bankroll and writes
      // the bet. Throws INSUFFICIENT_BANKROLL when the stake exceeds it.
      const { betId } = await BK.placeBet(db, user.uid, betData);

      // A manually marked winner is graded immediately, so its estimated
      // winnings credit now (settleCredit is a no-op if already credited).
      if (winner && payout > 0) {
        await BK.settleCredit(db, user.uid, betId, payout);
      }

      await refreshBankrollDisplay();

      const balanceText = bankrollBalanceEl ? bankrollBalanceEl.textContent : "";
      setResultMessage(`Bet saved. ${balanceText} left in your virtual bankroll.`);

      loadBetHistory();

    } catch (error) {

      console.error(error);

      if (error && error.message === "INSUFFICIENT_BANKROLL") {
        let balanceText = "your virtual bankroll";
        try {
          const data = await BK.ensureBankroll(db, user.uid);
          balanceText = BK.formatMoney(data.balance);
          if (bankrollBalanceEl) bankrollBalanceEl.textContent = balanceText;
        } catch (_) {
          // Keep the generic wording if the re-read fails.
        }
        alert(`That stake (${BK.formatMoney(betAmount)}) is more than ${balanceText} in your virtual bankroll. Lower the stake, or reset your bankroll on the dashboard.`);
        return;
      }

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
    let snapshot;
    try {
      snapshot = await db
        .collection("bets")
        .where("userId", "==", user.uid)
        // Query newest-first so limit(50) returns the most recent bets.
        .orderBy("createdAtMs", "desc")
        .limit(50)
        .get();
    } catch (orderError) {
      console.warn("Falling back to unordered history query.", orderError);
      snapshot = await db
        .collection("bets")
        .where("userId", "==", user.uid)
        .limit(50)
        .get();
    }
    const bets = [];
    snapshot.forEach((doc) => bets.push({ id: doc.id, ...doc.data() }));
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

  historySection.innerHTML = "";

  sorted.forEach((bet) => {
    // Use DOM APIs/textContent to prevent injection from stored free-text fields.
    const row = document.createElement("div");
    row.className = "bet-row";

    const trackStrong = document.createElement("strong");
    trackStrong.textContent = bet.trackName || "Unknown Track";
    row.appendChild(trackStrong);
    row.appendChild(document.createTextNode(` Race ${bet.raceNumber || "—"}`));
    row.appendChild(document.createElement("br"));

    row.appendChild(document.createTextNode(`Horse: ${bet.horseName || "—"}`));
    row.appendChild(document.createElement("br"));

    row.appendChild(
      document.createTextNode(
        `Bet: $${Number(bet.betAmount || 0).toFixed(2)} Odds: ${bet.odds || "—"}`
      )
    );
    row.appendChild(document.createElement("br"));

    row.appendChild(document.createTextNode(`Outcome: ${bet.outcome || "pending"}`));
    row.appendChild(document.createElement("br"));

    row.appendChild(
      document.createTextNode(`Winnings: $${Number(bet.winnings || 0).toFixed(2)}`)
    );
    row.appendChild(document.createElement("br"));

    row.appendChild(
      document.createTextNode(
        bet.settled
          ? `Settled ✓ (finished ${bet.settledPosition ?? "—"})`
          : "Not settled yet"
      )
    );
    row.appendChild(document.createElement("br"));

    row.appendChild(document.createTextNode(`Time: ${formatBetTime(bet)}`));

    historySection.appendChild(row);
    historySection.appendChild(document.createElement("hr"));
  });
}

function startBetHistoryTracking(userId) {
  if (!userId) return;

  if (typeof unsubscribeHistory === "function") {
    unsubscribeHistory();
  }

  historySection.innerHTML = "Tracking live bet history...";

  const onSnapshotSuccess = (snapshot) => {
    const bets = [];
    snapshot.forEach((doc) => bets.push({ id: doc.id, ...doc.data() }));
    renderBetHistory(bets);
  };

  const onSnapshotError = (error) => {
    console.error(error);
    historySection.innerHTML = "Error tracking history. Tap Load Bet History to retry.";
  };

  unsubscribeHistory = db
    .collection("bets")
    .where("userId", "==", userId)
    // Keep live feed in newest-first order for a stable UX.
    .orderBy("createdAtMs", "desc")
    .limit(50)
    .onSnapshot(onSnapshotSuccess, (error) => {
      console.warn("Falling back to unordered live history query.", error);
      if (typeof unsubscribeHistory === "function") {
        unsubscribeHistory();
      }

      unsubscribeHistory = db
        .collection("bets")
        .where("userId", "==", userId)
        .limit(50)
        .onSnapshot(onSnapshotSuccess, onSnapshotError);
    });
}

/* ------------------------------------
9. Share Bet Link
------------------------------------ */

if (shareBtn) {

  shareBtn.addEventListener("click", () => {

    const { trackName: track, horseName: horse, odds } = getBetFormValues();

    const text =
      "My bet: " +
      sanitizeText(horse) +
      " at " +
      sanitizeText(track) +
      " odds " +
      sanitizeText(odds);

    navigator.clipboard.writeText(text);

    alert("Bet copied to clipboard.");

  });

}

if (loadHistoryBtn) {
  loadHistoryBtn.addEventListener("click", () => {
    loadBetHistory();
  });
}

/* ------------------------------------
10. Newbie helpers: bet-type + odds explainers, quick stake chips
------------------------------------ */

// Plain-English meaning of each bet type (matches BET_TYPE_CONFIG keys).
const BET_MODE_HELP = {
  win: "Your horse must finish 1st. Simplest bet — start here.",
  place: "Your horse must finish 1st or 2nd. Easier to hit, smaller payout.",
  show: "Your horse must finish 1st, 2nd, or 3rd. Easiest to hit, smallest payout.",
  exacta: "Pick the 1st AND 2nd finishers, in exact order. Harder — bigger payout.",
  exacta_box: "Pick two horses to finish 1st and 2nd in either order.",
  trifecta: "Pick the 1st, 2nd, AND 3rd finishers, in exact order.",
  trifecta_key: "Pick one horse to win, plus two others to fill 2nd and 3rd in any order.",
  superfecta: "Pick the 1st, 2nd, 3rd, AND 4th finishers, in exact order.",
  pick3: "Pick the winners of 3 races in a row.",
  pick4: "Pick the winners of 4 races in a row.",
  pick5: "Pick the winners of 5 races in a row.",
  pick6: "Pick the winners of 6 races in a row.",
};

const betModeHelp = document.getElementById("betModeHelp");
const oddsHelp = document.getElementById("oddsHelp");
const stakeChips = document.querySelectorAll(".stake-chip");

function updateBetModeHelp() {
  if (betModeHelp && betMode) {
    betModeHelp.textContent = BET_MODE_HELP[betMode.value] || "";
  }
}

function money(value) {
  return `$${Number(value).toFixed(2)}`;
}

// Translate the typed odds into plain English, with a live example at the
// current stake. Fractional ("5/2") gets the classic "every $Y wins $X"
// line; decimal/American odds get the "every $1 returns $Z" line.
function updateOddsHelp() {
  if (!oddsHelp) return;
  const raw = (oddsInput?.value || "").trim();
  const stake = parseFloat(betAmountInput?.value);

  const frac = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den > 0) {
      let text = `${raw} means: every $${den} you bet wins $${num} profit.`;
      if (Number.isFinite(stake) && stake > 0) {
        const profit = (stake * num) / den;
        text += ` At your ${money(stake)} stake, that's ${money(profit)} profit — ${money(stake + profit)} back total.`;
      }
      oddsHelp.textContent = text;
      return;
    }
  }

  const decimal = parseOddsToDecimalMultiplier(raw);
  if (decimal) {
    oddsHelp.textContent = `${raw} means: every $1 you bet returns $${decimal.toFixed(2)} total (stake + profit).`;
    return;
  }

  oddsHelp.textContent = "Example: 5/2 means a $2 bet wins $5 profit. Type odds like 5/2, 3.50, or +150.";
}

if (betMode) {
  betMode.addEventListener("change", updateBetModeHelp);
  updateBetModeHelp();
}

if (oddsInput) {
  oddsInput.addEventListener("input", updateOddsHelp);
}

if (betAmountInput) {
  betAmountInput.addEventListener("input", () => {
    stakeChips.forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.amount === betAmountInput.value);
    });
    updateOddsHelp();
  });
}

stakeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (betAmountInput) betAmountInput.value = chip.dataset.amount;
    stakeChips.forEach((other) => other.classList.toggle("active", other === chip));
    updateOddsHelp();
  });
});

updateOddsHelp();

/* ------------------------------------
11. Phase 2-lite settlement (free): real positions, estimated payouts
------------------------------------ */
// Settles unsettled Win / Place / Show bets against the real finishing
// positions from the same provider that feeds Today's Card. Payouts stay
// ESTIMATED (from the odds entered at bet time) because real starting
// prices need a paid plan. Exotic bets are skipped with a note — one
// horse's position cannot settle an exacta, trifecta, superfecta, or pick N.

const settleDateInput = document.getElementById("settleDate");
const settleBetsBtn = document.getElementById("settleBetsBtn");
const settleStatus = document.getElementById("settleStatus");
const SU = (typeof window !== "undefined" && window.SettleUtils) || null;

function setSettleStatus(text) {
  if (settleStatus) settleStatus.textContent = text;
}

function defaultSettleDate() {
  if (!settleDateInput) return "";
  if (!settleDateInput.value) {
    settleDateInput.value = (SU ? SU.localDateString(Date.now()) : "");
  }
  return settleDateInput.value;
}

async function fetchSettleResults(dateStr) {
  const res = await fetch(
    `/.netlify/functions/apihorseracing?action=results&date=${encodeURIComponent(dateStr)}`,
    { cache: "no-store" }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error((body && body.message) || `Results request failed (${res.status}).`);
  }
  return body.data;
}

async function fetchSettleResult(raceId) {
  const res = await fetch(
    `/.netlify/functions/apihorseracing?action=result&id=${encodeURIComponent(String(raceId))}`,
    { cache: "no-store" }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error((body && body.message) || `Result request failed (${res.status}).`);
  }
  return body.data;
}

async function settleBets() {
  if (!SU) {
    setSettleStatus("Settlement helpers failed to load. Reload the page and try again.");
    return;
  }
  const user = auth.currentUser;
  if (!user) {
    setSettleStatus("Log in to settle bets.");
    return;
  }
  const dateStr = defaultSettleDate();
  if (!dateStr) {
    setSettleStatus("Pick a date to settle.");
    return;
  }
  if (settleBetsBtn) settleBetsBtn.disabled = true;
  setSettleStatus(`Checking ${dateStr} results…`);
  try {
    let snapshot;
    try {
      snapshot = await db
        .collection("bets")
        .where("userId", "==", user.uid)
        .orderBy("createdAtMs", "desc")
        .limit(50)
        .get();
    } catch (orderError) {
      snapshot = await db
        .collection("bets")
        .where("userId", "==", user.uid)
        .limit(50)
        .get();
    }
    const bets = [];
    snapshot.forEach((doc) => bets.push({ id: doc.id, ...doc.data() }));

    // Only bets placed on the chosen date, not yet settled.
    const due = bets.filter(
      (b) => b.settled !== true && SU.localDateString(getBetSortTime(b)) === dateStr
    );
    if (!due.length) {
      setSettleStatus(`No unsettled bets placed on ${dateStr}.`);
      return;
    }

    const resultsMeetings = await fetchSettleResults(dateStr);
    const raceIndex = SU.indexResults(resultsMeetings);
    const notes = [];
    let settledCount = 0;

    // Group due bets by (course + race number) so each race is fetched once.
    const groups = new Map();
    due.forEach((bet) => {
      const key = `${SU.normalizeName(bet.trackName)}|${bet.raceNumber}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(bet);
    });

    for (const [key, groupBets] of groups) {
      const race = raceIndex.get(key);
      if (!race) {
        groupBets.forEach((b) =>
          notes.push(`${b.horseName || "—"} (${b.trackName} R${b.raceNumber}): no result for this race on ${dateStr}`)
        );
        continue;
      }
      let resultData;
      try {
        resultData = await fetchSettleResult(race.raceId);
      } catch (err) {
        groupBets.forEach((b) =>
          notes.push(`${b.horseName || "—"} (${b.trackName} R${b.raceNumber}): result not ready yet`)
        );
        continue;
      }
      for (const bet of groupBets) {
        const settled = SU.settleFromResult(bet.betType, resultData, bet.horseName);
        if (settled.outcome === null) {
          notes.push(`${bet.horseName} (${bet.trackName} R${bet.raceNumber}): ${settled.note}`);
          continue;
        }
        let payout = Number(bet.payout);
        if (!Number.isFinite(payout)) {
          payout = calculateOdds(bet.betAmount, bet.odds, bet.betType);
        }
        if (payout === null || !Number.isFinite(payout)) {
          notes.push(`${bet.horseName} (${bet.trackName} R${bet.raceNumber}): could not compute payout from entered odds`);
          continue;
        }
        const winnings = settled.outcome === "win" ? payout : 0;
        try {
          await db.collection("bets").doc(bet.id).update({
            outcome: settled.outcome,
            winnings,
            settled: true,
            settledAtMs: Date.now(),
            settledPosition: settled.position,
          });
          // Virtual bankroll: credit winnings exactly once. No-op for bets
          // placed before the feature and for re-runs (guarded by the
          // bankrollCredited flag inside settleCredit).
          if (BK) {
            try {
              await BK.settleCredit(db, user.uid, bet.id, winnings);
            } catch (bkErr) {
              console.error(bkErr);
              notes.push(`${bet.horseName} (${bet.trackName} R${bet.raceNumber}): settled, but the bankroll credit failed — check the dashboard`);
            }
          }
          settledCount += 1;
          notes.push(`${bet.horseName} (${bet.trackName} R${bet.raceNumber}): ${settled.note} → ${settled.outcome}`);
        } catch (err) {
          console.error(err);
          notes.push(`${bet.horseName} (${bet.trackName} R${bet.raceNumber}): could not save settlement`);
        }
      }
    }

    setSettleStatus(
      `Settled ${settledCount} bet(s) on ${dateStr}.` + (notes.length ? ` ${notes.join(" · ")}` : "")
    );
    await refreshBankrollDisplay();
    loadBetHistory();
  } catch (err) {
    console.error(err);
    setSettleStatus(`Could not settle: ${err.message}`);
  } finally {
    if (settleBetsBtn) settleBetsBtn.disabled = false;
  }
}

defaultSettleDate();
if (settleBetsBtn) {
  settleBetsBtn.addEventListener("click", settleBets);
}

/* ------------------------------------
12. Virtual bankroll (paper betting)
------------------------------------ */
// $1,000 in virtual money per user. Stakes deduct when a bet is placed,
// winnings credit when it settles. Fake money for learning — no real
// money anywhere. All money movement goes through window.Bankroll so the
// dashboard and the calculator share one implementation.

const bankrollBalanceEl = document.getElementById("bankrollBalance");
const BK = (typeof window !== "undefined" && window.Bankroll) || null;

async function refreshBankrollDisplay() {
  if (!bankrollBalanceEl || !BK) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    const data = await BK.ensureBankroll(db, user.uid);
    bankrollBalanceEl.textContent = BK.formatMoney(data.balance);
  } catch (err) {
    console.error(err);
    bankrollBalanceEl.textContent = "—";
  }
}
