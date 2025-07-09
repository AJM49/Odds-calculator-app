function calculateOdds() {
  document.title = `💰 ${oddsType.toUpperCase()} Bet Return`;
const MIN_BET = 0.5;
const MAX_BET = 1000000;

if (isNaN(betAmount) || betAmount < MIN_BET) {
  alert(`Please enter a bet of at least $${MIN_BET.toFixed(2)}.`);
  return;
}
if (betAmount > MAX_BET) {
  alert(`That’s too large—please enter $${MAX_BET.toLocaleString()} or less.`);
  return;
}

  switch (oddsType) {
    case "fractional":
      const [num, den] = oddsInput.split('/').map(Number);
      if (!num || !den) {
        alert("Invalid fractional odds (e.g., use 9/5).");
        return;
      }
      profit = (betAmount * num) / den;
      break;

    case "decimal":
      const decimal = parseFloat(oddsInput);
      if (isNaN(decimal) || decimal <= 1) {
        alert("Invalid decimal odds (must be > 1).");
        return;
      }
      profit = betAmount * (decimal - 1);
      break;

    case "moneyline":
      const ml = parseInt(oddsInput);
      if (isNaN(ml)) {
        alert("Invalid moneyline odds.");
        return;
      }
      if (ml > 0) {
        profit = (betAmount * ml) / 100;
      } else {
        profit = (betAmount * 100) / Math.abs(ml);
      }
      break;
  }

  totalReturn = betAmount + profit;

  document.getElementById("results").innerHTML = `
    <p><strong>Profit:</strong> $${profit.toFixed(2)}</p>
    <p><strong>Total Return:</strong> $${totalReturn.toFixed(2)}</p>
  `;
}
