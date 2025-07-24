const MIN_BET = 0.5;

function parseToDecimal(type, input) {
  if (type === "fractional") {
    const [num, denom] = input.split("/").map(Number);
    return 1 + (num / denom);
  } else if (type === "decimal") {
    return parseFloat(input);
  } else if (type === "moneyline") {
    const ml = parseFloat(input);
    return ml > 0 ? (ml / 100) + 1 : (100 / Math.abs(ml)) + 1;
  }
}

function decimalToFraction(decimal) {
  const frac = decimal - 1;
  const denom = 100;
  const num = Math.round(frac * denom);
  return `${num}/${denom}`;
}

function decimalToMoneyline(decimal) {
  const profit = decimal - 1;
  return profit >= 1
    ? `+${Math.round(profit * 100)}`
    : `-${Math.round(100 / profit)}`;
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('✅ Service Worker registered:', reg))
      .catch(err => console.error('❌ Service Worker error:', err));
  });
}



function calculateOdds() {
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType = document.getElementById("oddsType").value;
  const oddsInput = document.getElementById("oddsInput").value.trim();
  const betMode = document.getElementById("betMode").value;

  const descriptions = {
    win: "🏆 Horse must finish 1st",
    place: "🥈 Horse must finish 1st or 2nd",
    show: "🥉 Horse must finish 1st, 2nd, or 3rd",
    exacta: "🔢 Pick 1st and 2nd in exact order",
    trifecta: "🔁 Pick 1st, 2nd, and 3rd in order",
    superfecta: "🎯 Pick 1st through 4th in exact order"
  };

  document.getElementById("betDescription").innerText = descriptions[betMode];

  if (isNaN(betAmount) || betAmount < MIN_BET) {
    alert(`Please enter a bet of at least $${MIN_BET.toFixed(2)}.`);
    return;
  }

  let decimalOdds;
  try {
    decimalOdds = parseToDecimal(oddsType, oddsInput);
    if (isNaN(decimalOdds) || decimalOdds <= 1) throw Error();
  } catch {
    alert("Invalid odds format.");
    return;
  }

  let profit, totalReturn;

  switch (betMode) {
    case "win":
      profit = betAmount * (decimalOdds - 1);
      break;
    case "place":
      profit = betAmount * ((decimalOdds - 1) / 2);
      break;
    case "show":
      profit = betAmount * ((decimalOdds - 1) / 3);
      break;
    case "exacta":
      profit = betAmount * 5;
      break;
    case "trifecta":
      profit = betAmount * 25;
      break;
    case "superfecta":
      profit = betAmount * 100;
      break;
    default:
      profit = 0;
  }

  totalReturn = betAmount + profit;

  document.getElementById("results").innerHTML = `
    <p><strong>Bet Type:</strong> ${betMode.toUpperCase()}</p>
    <p><strong>Profit:</strong> $${profit.toFixed(2)}</p>
    <p><strong>Total Return:</strong> $${totalReturn.toFixed(2)}</p>
  `;

  const frac = decimalToFraction(decimalOdds);
  const ml = decimalToMoneyline(decimalOdds);
  document.getElementById("conversion").innerHTML = `
    <h3>Equivalent Odds</h3>
    <p><strong>Fractional:</strong> ${frac}</p>
    <p><strong>Decimal:</strong> ${decimalOdds.toFixed(2)}</p>
    <p><strong>Moneyline:</strong> ${ml}</p>
  `;

  document.title = `💰 ${decimalOdds.toFixed(2)} Odds Return`;

  saveBetToHistory({
    amount: betAmount,
    odds: oddsInput,
    type: oddsType,
    mode: betMode,
    return: totalReturn,
    profit: profit
  });
}

function saveBetToHistory(bet) {
  let history = JSON.parse(localStorage.getItem("betHistory")) || [];
  history.unshift(bet);
  if (history.length > 10) history.pop();
  localStorage.setItem("betHistory", JSON.stringify(history));
  displayBetHistory();
}

function displayBetHistory() {
  const history = JSON.parse(localStorage.getItem("betHistory")) || [];
  const container = document.getElementById("historyContainer");

  if (history.length === 0) {
    container.innerHTML = "<p>No bets saved yet.</p>";
    return;
  }

  container.innerHTML = "<ul>" + history.map(bet => `
    <li>
      $${bet.amount.toFixed(2)} on ${bet.mode.toUpperCase()} @ ${bet.odds} (${bet.type}) → 
      Return: $${bet.return.toFixed(2)}, Profit: $${bet.profit.toFixed(2)}
    </li>`).join("") + "</ul>";
}

document.getElementById("clearHistory").addEventListener("click", () => {
  localStorage.removeItem("betHistory");
  displayBetHistory();
});

function loadFromURLParams() {
  const params = new URLSearchParams(window.location.search);
  const bet = parseFloat(params.get("bet"));
  const odds = params.get("odds");
  const type = params.get("type");
  const mode = params.get("mode");

  if (bet && odds && type) {
    document.getElementById("betAmount").value = bet;
    document.getElementById("oddsInput").value = odds;
    document.getElementById("oddsType").value = type;
    if (mode) document.getElementById("betMode").value = mode;
    calculateOdds();
  }
}

function copyShareLink() {
  const bet = document.getElementById("betAmount").value;
  const odds = document.getElementById("oddsInput").value;
  const type = document.getElementById("oddsType").value;
  const mode = document.getElementById("betMode").value;

  const baseUrl = window.location.origin + window.location.pathname;
  const shareURL = `${baseUrl}?bet=${bet}&odds=${encodeURIComponent(odds)}&type=${type}&mode=${mode}`;

  navigator.clipboard.writeText(shareURL)
    .then(() => alert("Link copied to clipboard!"))
    .catch(() => alert("Failed to copy link."));
}

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
}

function toggleTheme() {
  const currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("theme", newTheme);
}

document.getElementById("themeToggle").addEventListener("click", toggleTheme);

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
  displayBetHistory();
  loadFromURLParams();
});
