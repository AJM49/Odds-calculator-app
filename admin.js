import { auth, db } from './firebase.js';

// Check if user is admin
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Check if admin
  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    document.getElementById('adminStatus').textContent = "Access denied. Admin only.";
    return;
  }

  document.getElementById('adminStatus').style.display = "none";
  document.getElementById('adminContent').style.display = "block";

  loadUsers();
  loadBets();
  loadDashboardSummary();
});

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

async function loadUsers() {
  const usersTableBody = document.querySelector('#usersTable tbody');
  usersTableBody.innerHTML = '';

  const snapshot = await db.collection('users').get();
  snapshot.forEach(doc => {
    const user = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>
        <button onclick="changeRole('${doc.id}', '${user.role === 'admin' ? 'user' : 'admin'}')">Toggle Role</button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });
}

async function loadBets() {
  const betsTableBody = document.querySelector('#betsTable tbody');
  betsTableBody.innerHTML = '';

  const snapshot = await db.collection('bets').get();
  snapshot.forEach(doc => {
    const bet = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${bet.userId}</td>
      <td>${bet.betType}</td>
      <td>$${bet.amount}</td>
      <td>${bet.odds}</td>
      <td>${bet.result || 'pending'}</td>
      <td>
        <button onclick="deleteBet('${doc.id}')">Delete</button>
      </td>
    `;
    betsTableBody.appendChild(tr);
  });
}

async function changeRole(userId, newRole) {
  await db.collection('users').doc(userId).update({ role: newRole });
  loadUsers();
}

async function deleteBet(betId) {
  if (confirm("Are you sure you want to delete this bet?")) {
    await db.collection('bets').doc(betId).delete();
    loadBets();
  }
}

// Expose functions
window.changeRole = changeRole;
window.deleteBet = deleteBet;
