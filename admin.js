async function loadDashboardSummary() {
  try {
    // Use server-side aggregation count queries to reduce read costs.
    const userCountSnapshot = await db.collection('users').where('role', '!=', 'admin').count().get();
    const betCountSnapshot = await db.collection('bets').count().get();

    document.getElementById('totalUsers').textContent = userCountSnapshot.data().count;
    document.getElementById('totalBets').textContent = betCountSnapshot.data().count;

    // Still fetch bet docs once for total wagered amount calculation.
    const betSnapshot = await db.collection('bets').select('betAmount', 'amount').get();
    let totalAmount = 0;
    betSnapshot.forEach((doc) => {
      const data = doc.data();
      totalAmount += Number(data.betAmount ?? data.amount ?? 0);
    });
    document.getElementById('totalWagered').textContent = `$${totalAmount.toFixed(2)}`;
  } catch (error) {
    console.error('Failed to load dashboard summary:', error);
  }
}

// Run summary on load
loadDashboardSummary();
