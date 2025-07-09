// Validation constants
const MIN_BET = 0.5;
const MAX_BET = 1000000;

// Utility: Compute GCD for fraction reduction
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

// Convert decimal odds to a reduced fractional string
function decimalToFraction(decimalOdds) {
  const fraction = decimalOdds - 1;
  const precision = 100;                    // denominator up to 100
  let num = Math.round(fraction * precision);
  let den = precision;
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  return `${num}/${den}`;
}

// Convert decimal odds to moneyline integer
function decimalToMoneyline(decimalOdds) {
  if (decimalOdds >= 2) {
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (decimalOdds - 1))}`;
  }
}

// Parse any input into decimal odds
function parseToDecimal(oddsType, oddsInput) {
  let decimal;
  switch (oddsType) {
    case "fractional": {
      const [n, d] = oddsInput.split("/").map(Number);
      decimal = 1 + (n / d);
      break;
    }
    case "decimal": {
      decimal = parseFloat(oddsInput);
      break;
    }
    case "moneyline": {
      const ml = parseInt(oddsInput, 10);
      if (ml > 0) {
        decimal = 1 + ml / 100;
      } else {
        decimal = 1 + 100 / Math.abs(ml);
      }
      break;
    }
  }
  return decimal;
}

// Main function
function calculateOdds() {
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType  = document.getElementById("oddsType").value;
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

  // Convert input odds to decimal
  let decimalOdds;
  try {
    decimalOdds = parseToDecimal(oddsType, oddsInput);
    if (isNaN(decimalOdds) || decimalOdds <= 1) throw Error();
  } catch {
    alert("Invalid odds format—check your input.");
    return;
  }

  // Calculate profit & return
  const profit      = betAmount * (decimalOdds - 1);
  const totalReturn = betAmount + profit;

  // Display profit & return
  document.getElementById("results").innerHTML = `
    <p><strong>Profit:</strong> $${profit.toFixed(2)}</p>
    <p><strong>Total Return:</strong> $${totalReturn.toFixed(2)}</p>
  `;

  // Display converted odds
  const frac = decimalToFraction(decimalOdds);
  const ml   = decimalToMoneyline(decimalOdds);
  document.getElementById("conversion").innerHTML = `
    <h3>Equivalent Odds</h3>
    <p><strong>Fractional:</strong> ${frac}</p>
    <p><strong>Decimal:</strong> ${decimalOdds.toFixed(2)}</p>
    <p><strong>Moneyline:</strong> ${ml}</p>
  `;

  // Dynamic tab title
  document.title = `💰 ${decimalOdds.toFixed(2)} Odds Return`;
}

// Wire up button
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calcBtn").addEventListener("click", calculateOdds);
});
