function calculateOdds() {
  document.title = `💰 ${oddsType.toUpperCase()} Bet Return`;
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType = document.getElementById("oddsType").value;
  const oddsInput = document.getElementById("oddsInput").value.trim();
  let profit = 0;
  let totalReturn = 0;

  if (isNaN(betAmount) || betAmount <= 0) {
    alert("Please enter a valid bet amount.");
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
