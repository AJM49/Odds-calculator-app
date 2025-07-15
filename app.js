const MIN_BET = 0.5;
const MAX_BET = 1000000;

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function decimalToFraction(decimalOdds) {
  const fraction = decimalOdds - 1;
  const precision = 100;
  let num = Math.round(fraction * precision);
  let den = precision;
  const divisor = gcd(num, den);
  num /= divisor;
  den /= divisor;
  return `${num}/${den}`;
}

function decimalToMoneyline(decimalOdds) {
  if (decimalOdds >= 2) {
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (decimalOdds - 1))}`;
  }
}

function parseToDecimal(oddsType, oddsInput) {
  let decimal;
  switch (oddsType) {
    case "fractional":
      const [n, d] = oddsInput.split("/").map(Number);
      decimal = 1 + (n / d);
      break;
    case "decimal":
      decimal = parseFloat(oddsInput);
      break;
    case "moneyline":
      const ml = parseInt(oddsInput, 10);
      decimal = ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml);
      break;
  }
  return decimal;
}

function calculateOdds() {
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const oddsType = document.getElementById("oddsType").value;
  const oddsInput = document.getElementById("oddsInput").value.trim();

  if (isNaN(betAmount) || betAmount < MIN_BET) {
    alert(`Please enter a bet of at least $${MIN_BET.toFixed(2)}.`);
    return;
  }

  if (betAmount > MAX_BET) {
    alert(`Please enter $${MAX_BET.toLocaleString()} or less.`);
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
}

// Parlay Section
let legCounter = 0;

function addParlayLeg() {
  const container = document.getElementById("legsContainer");
  const legDiv = document.createElement("div");
  legDiv.className = "parlay-leg";

  legDiv.innerHTML = `
    <div>
      <label>Leg ${legCounter + 1}</label>
      <select class="parlay-odds-type">
        <option value="fractional">Fractional</option>
        <option value="decimal">Decimal</option>
        <option value="moneyline">Moneyline</option>
      </select>
      <input type="text" class="parlay-odds" placeholder="e.g. 9/5 or 2.8 or +180" />
      <button class="removeLeg" style="margin-left: 10px;">❌</button>
    </div>
  `;

  container.appendChild(legDiv);

  legDiv.querySelector(".removeLeg").addEventListener("click", () => {
    container.removeChild(legDiv);
  });

  legCounter++;
}

function calculateParlay() {
  const betAmount = parseFloat(document.getElementById("parlayBet").value);
  if (isNaN(betAmount) || betAmount < MIN_BET) {
    alert("Enter a valid parlay bet amount (min $0.50).");
    return;
  }

  const oddsInputs = document.querySelectorAll(".parlay-leg");
  if (oddsInputs.length === 0) {
    alert("Please add at least one leg.");
    return;
  }

  let combinedDecimal = 1;

  for (const leg of oddsInputs) {
    const type = leg.querySelector(".parlay-odds-type").value;
    const input = leg.querySelector(".parlay-odds").value.trim();
    const decimal = parseToDecimal(type, input);

    if (isNaN(decimal) || decimal <= 1) {
      alert("One or more legs has an invalid odds entry.");
      return;
    }

    combinedDecimal *= decimal;
  }

  const profit = betAmount * (combinedDecimal - 1);
  const totalReturn = betAmount + profit;

  document.getElementById("parlayResults").innerHTML = `
    <h3>Parlay Results</h3>
    <p><strong>Combined Odds (Decimal):</strong> ${combinedDecimal.toFixed(3)}</p>
    <p><strong>Profit:</strong> $${profit.toFixed(2)}</p>
    <p><strong>Total Return:</strong> $${totalReturn.toFixed(2)}</p>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calcBtn").addEventListener("click", calculateOdds);
  document.getElementById("addLeg").addEventListener("click", addParlayLeg);
  document.getElementById("calcParlay").addEventListener("click", calculateParlay);
});
