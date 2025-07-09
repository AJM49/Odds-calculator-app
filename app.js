// Constants for validation
const MIN_BET = 0.5;
const MAX_BET = 1000000;

// Main calculation function
function calculateOdds() {
  // Grab inputs
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType = document.getElementById("oddsType").value;
  const oddsInput = document.getElementById("oddsInput").value.trim();

  // Validation
  if (isNaN(betAmount) || betAmount < MIN_BET) {
    alert(`Please enter a bet of at least $${MIN_BET.toFixed(2)}.`);
    return;
  }
  if (betAmount > MAX_BET) {
    alert(`That’s too large—please enter $${MAX_BET.toLocaleString()} or less.`);
    return;
  }

  let profit = 0;
  let totalReturn = 0;

  // Calculation by odds type
  switch (oddsType) {
    case "fractional": {
      const parts = oddsInput.split("/");
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!numerator || !denominator) {
        alert("Invalid fractional odds. Use format like 9/5.");
        return;
      }
      profit = (betAmount * numerator) / denominator;
      break;
    }
    case "decimal": {
      const decimal = parseFloat(oddsInput);
      if (isNaN(decimal) || decimal <= 1) {
        alert("Invalid decimal odds. Must be greater than 1 (e.g. 2.8).");
        return;
      }
      profit = betAmount * (decimal - 1);
      break;
    }
    case "moneyline": {
      const ml = parseInt(oddsInput, 10);
      if (isNaN(ml) || ml === 0) {
        alert("Invalid moneyline odds. Use + or - values, e.g. +180 or -150.");
        return;
      }
      if (ml > 0) {
        profit = (betAmount * ml) / 100;
      } else {
        profit = (betAmount * 100) / Math.abs(ml);
      }
      break;
    }
    default:
      alert("Unknown odds type.");
      return;
  }

  totalReturn = betAmount + profit;

  // Update page title dynamically
  document.title = `💰 ${oddsType.charAt(0).toUpperCase() + oddsType.slice(1)} Return`;

  // Display results
  document.getElementById("results").innerHTML = `
    <p><strong>Profit:</strong> $${profit.toFixed(2)}</p>
    <p><strong>Total Return:</strong> $${totalReturn.toFixed(2)}</p>
  `;
}

// Attach event listener once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calcBtn").addEventListener("click", calculateOdds);
});
