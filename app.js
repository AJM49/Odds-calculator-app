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

function calculateOdds() {
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType = document.getElementById("oddsType").value;
  const oddsInput = document.getElementById("oddsInput").value.trim();

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

  const profit = betAmount * (decimalOdds - 1);
  const totalReturn = betAmount + profit;

  document.getElementById("results").innerHTML = `
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

  // Save bet to history
  saveBetToHistory({
    amount: betAmount,
    odds: oddsInput,
    type: oddsType,
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
      Bet $${bet.amount.toFixed(2)} @ ${bet.odds} (${bet.type}) → 
      Return: $${bet.return.toFixed(2)}, Profit: $${bet.profit.toFixed(2)}
    </li>`).join("") + "</ul>";
}

document.getElementById("clearHistory").addEventListener("click", () => {
  localStorage.removeItem("betHistory");
  displayBetHistory();
});

window.addEventListener("load", displayBetHistory);
