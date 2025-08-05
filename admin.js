async function loadDashboardSummary() {
  // Load total users
  const userSnapshot = await db.collection('users').where('role', '!=', 'admin').get();
  document.getElementById('totalUsers').textContent = userSnapshot.size;

  // Load total bets and total wagered
  const betSnapshot = await db.collection('bets').get();
  document.getElementById('totalBets').textContent = betSnapshot.size;

  let totalAmount = 0;
  betSnapshot.forEach(doc => {
    const data = doc.data();
    totalAmount += parseFloat(data.amount || 0);
  });
  document.getElementById('totalWagered').textContent = `$${totalAmount.toFixed(2)}`;
}

// Run summary on load
loadDashboardSummary();
