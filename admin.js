import { 
  auth, 
  db, 
  onAuthStateChanged,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch
} from './firebase.js';

console.log('👨‍💼 Admin dashboard module loaded');

// ========== UTILITY FUNCTIONS ==========

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = type;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

/**
 * Show loading state on button
 */
function showLoading(buttonEl) {
  if (!buttonEl) return;
  buttonEl.disabled = true;
  buttonEl.dataset.originalText = buttonEl.textContent;
  buttonEl.textContent = '⏳ Loading...';
}

/**
 * Hide loading state on button
 */
function hideLoading(buttonEl) {
  if (!buttonEl) return;
  buttonEl.disabled = false;
  buttonEl.textContent = buttonEl.dataset.originalText || 'Submit';
}

/**
 * Show confirmation dialog
 */
function showConfirmDialog(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirmDialog');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmYes');
    const cancelBtn = document.getElementById('confirmCancel');
    
    if (!dialog) {
      resolve(confirm(message));
      return;
    }
    
    titleEl.textContent = title;
    msgEl.textContent = message;
    dialog.style.display = 'flex';
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      dialog.style.display = 'none';
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

/**
 * Show empty state in table
 */
function showEmptyState(tableId, message = 'No data found') {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  
  const colCount = table.querySelector('thead tr').children.length;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colCount}" style="text-align: center; padding: 40px; color: #999;">
        ${message}
      </td>
    </tr>
  `;
}

// ========== AUTH & INITIALIZATION ==========

// Check if user is admin
onAuthStateChanged(auth, async (user) => {
  const statusEl = document.getElementById('adminStatus');
  
  console.log('🔐 Auth state changed. User:', user ? user.email : 'NOT LOGGED IN');
  
  if (!user) {
    console.log('❌ No user logged in, redirecting to login');
    if (statusEl) statusEl.textContent = "Not logged in. Redirecting to login...";
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
    return;
  }

  console.log('✓ User logged in:', user.email, 'UID:', user.uid);
  
  // Check if admin 
  try {
    console.log('🔍 Checking admin status...');
    
    // Method 1: Try querying by uid field
    let isAdmin = false;
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '==', user.uid));
      const userSnapshot = await getDocs(q);
      
      console.log(`Found ${userSnapshot.docs.length} user documents matching uid`);
      
      userSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('User doc data:', data);
        if (data.role === 'admin') {
          isAdmin = true;
        }
      });
    } catch (queryError) {
      console.warn('⚠️ Query method failed:', queryError.code, queryError.message);
    }
    
    // Method 2: If query failed, try reading direct document by UID
    if (!isAdmin) {
      try {
        console.log('Trying direct document read...');
        // This won't work without getDocs, so skip for now
      } catch (docError) {
        console.warn('Document read failed:', docError);
      }
    }
    
    if (!isAdmin) {
      console.log('❌ User is not an admin');
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color: #d32f2f; padding: 20px; border-radius: 8px; background: #ffebee;">
            <strong>❌ Access Denied</strong><br>
            Your account (${user.email}) is not an admin.<br>
            <br>
            <small style="color: #666;">
              To become an admin, a current admin must update your user document in Firestore and set: <code>role: "admin"</code>
            </small>
          </div>
        `;
      }
      return;
    }
    
    console.log('✅ User IS an admin! Showing dashboard');
    if (statusEl) statusEl.style.display = "none";
    const contentEl = document.getElementById('adminContent');
    if (contentEl) contentEl.style.display = "block";
    
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="color: #d32f2f; padding: 20px; border-radius: 8px; background: #ffebee;">
          <strong>❌ Error Verifying Admin Status</strong><br>
          <code>${error.message}</code><br>
          <small>Check browser console (F12) for details</small>
        </div>
      `;
    }
    return;
  }

  // Load data
  try {
    console.log('📊 Loading dashboard data...');
    await loadUsers();
    await loadBets();
    await loadDashboardSummary();
    await loadAuditLogs();
    console.log('✅ All dashboard data loaded successfully');
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
});

async function loadDashboardSummary() {
  try {
    console.log('📊 Computing dashboard summary...');
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`User count from Firestore: ${usersSnapshot.docs.length}`);
    
    let userCount = 0;
    usersSnapshot.forEach(doc => {
      if (doc.data().role !== 'admin') {
        userCount++;
      }
    });

    // Get all bets
    const betsSnapshot = await getDocs(collection(db, 'bets'));
    console.log(`Bet count from Firestore: ${betsSnapshot.docs.length}`);
    
    let betCount = 0;
    let totalWagered = 0;
    const outcomes = { win: 0, loss: 0, pending: 0 };
    
    betsSnapshot.forEach(doc => {
      const data = doc.data();
      betCount++;
      totalWagered += Number(data.betAmount ?? data.amount ?? 0);
      
      const outcome = String(data.outcome || 'pending').toLowerCase();
      if (outcome === 'win') outcomes.win++;
      else if (outcome === 'loss') outcomes.loss++;
      else outcomes.pending++;
    });

    const winLossRatio = betCount > 0 ? (outcomes.win / (outcomes.win + outcomes.loss) * 100).toFixed(1) : 0;

    document.getElementById('totalUsers').textContent = userCount;
    document.getElementById('totalBets').textContent = betCount;
    document.getElementById('totalWagered').textContent = `$${totalWagered.toFixed(2)}`;
    
    // Update win/loss stats
    const winLossEl = document.getElementById('winLossRatio');
    if (winLossEl) {
      winLossEl.textContent = `${winLossRatio}% (${outcomes.win}W/${outcomes.loss}L)`;
    }

    console.log(`Dashboard Summary: ${userCount} users, ${betCount} bets, $${totalWagered.toFixed(2)} wagered`);
  } catch (error) {
    console.error('❌ Failed to load dashboard summary:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showToast('✗ Failed to load summary: ' + error.message, 'error');
  }
}

async function loadUsers() {
  const usersTableBody = document.querySelector('#usersTable tbody');
  
  console.log('🔍 DEBUG: Starting loadUsers()');
  console.log('usersTableBody element:', usersTableBody);
  
  if (!usersTableBody) {
    console.error('❌ ERROR: #usersTable tbody not found in DOM');
    return;
  }
  
  usersTableBody.innerHTML = '';

  try {
    console.log('📋 Querying users collection...');
    const snapshot = await getDocs(collection(db, 'users'));
    
    console.log(`✓ Got ${snapshot.docs.length} user documents`);
    
    if (snapshot.empty) {
      console.log('⚠️ No users found in Firestore');
      showEmptyState('usersTable', 'No users found');
      return;
    }
    
    let userStats = {};
    const betsSnapshot = await getDocs(collection(db, 'bets'));
    
    console.log(`📊 Got ${betsSnapshot.docs.length} bet documents`);
    
    // Calculate stats per user
    betsSnapshot.forEach(doc => {
      const bet = doc.data();
      console.log('Bet userId:', bet.userId, '| Bet type:', bet.betType);
      
      if (!userStats[bet.userId]) {
        userStats[bet.userId] = { totalBets: 0, totalWagered: 0, wins: 0, losses: 0 };
      }
      userStats[bet.userId].totalBets++;
      userStats[bet.userId].totalWagered += Number(bet.betAmount ?? bet.amount ?? 0);
      
      const outcome = String(bet.outcome || 'pending').toLowerCase();
      if (outcome === 'win') userStats[bet.userId].wins++;
      else if (outcome === 'loss') userStats[bet.userId].losses++;
    });
    
    console.log('User stats built:', Object.keys(userStats).length, 'unique users with bets');

    snapshot.forEach(doc => {
      const user = doc.data();
      console.log('User doc id:', doc.id, '| User data:', user);
      
      const stats = userStats[doc.id] || { totalBets: 0, totalWagered: 0, wins: 0, losses: 0 };
      const winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets * 100).toFixed(1) : 0;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="user-checkbox" value="${doc.id}" data-email="${user.email}"></td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${stats.totalBets}</td>
        <td>$${stats.totalWagered.toFixed(2)}</td>
        <td>${winRate}%</td>
        <td>
          <button onclick="changeRole('${doc.id}', '${user.role === 'admin' ? 'user' : 'admin'}')">Toggle Role</button>
          <button onclick="deleteUser('${doc.id}', '${user.email}')" style="background-color: #f44336;">Delete</button>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    console.log('✓ Users loaded');
  } catch (error) {
    console.error('❌ ERROR loading users:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showToast('✗ Failed to load users: ' + error.message, 'error');
  }
}

async function loadBets() {
  const betsTableBody = document.querySelector('#betsTable tbody');
  betsTableBody.innerHTML = '';

  try {
    const q = query(collection(db, 'bets'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      showEmptyState('betsTable', 'No bets found');
      console.log('No bets found');
      return;
    }
    
    snapshot.forEach(doc => {
      const bet = doc.data();
      const timestamp = bet.timestamp ? new Date(bet.timestamp.toDate()).toLocaleString() : 'N/A';
      const betAmount = Number(bet.betAmount ?? bet.amount ?? 0);
      const winnings = Number(bet.winnings ?? 0);
      const profitLoss = winnings - betAmount;
      const roi = betAmount > 0 ? ((profitLoss / betAmount) * 100).toFixed(1) : 0;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="bet-checkbox" value="${doc.id}"></td>
        <td>${bet.userId.substring(0, 8)}...</td>
        <td>${bet.trackName || 'N/A'}</td>
        <td>${bet.betType}</td>
        <td>$${betAmount.toFixed(2)}</td>
        <td>${bet.outcome || 'pending'}</td>
        <td>$${winnings.toFixed(2)}</td>
        <td>${roi}%</td>
        <td>${timestamp}</td>
        <td>
          <button onclick="deleteBet('${doc.id}')" style="background-color: #f44336;">Delete</button>
        </td>
      `;
      betsTableBody.appendChild(tr);
    });

    console.log('✓ Bets loaded');
  } catch (error) {
    console.error('❌ ERROR loading bets:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showToast('✗ Failed to load bets: ' + error.message, 'error');
  }
}

/**
 * Load audit logs (bet submissions with timestamps)
 */
async function loadAuditLogs() {
  try {
    const auditTableBody = document.querySelector('#auditTable tbody');
    if (!auditTableBody) {
      console.log('No audit table found, skipping audit logs');
      return;
    }

    auditTableBody.innerHTML = '';
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      auditTableBody.innerHTML = '<tr><td colspan="5">No audit logs yet</td></tr>';
      return;
    }

    snapshot.forEach(doc => {
      const log = doc.data();
      const timestamp = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${timestamp}</td>
        <td>${log.userId.substring(0, 8)}...</td>
        <td>${log.action || 'UNKNOWN'}</td>
        <td>${log.betType || 'N/A'}</td>
        <td>${log.details || 'N/A'}</td>
      `;
      auditTableBody.appendChild(tr);
    });

    console.log('✓ Audit logs loaded');
  } catch (error) {
    console.error('Error loading audit logs:', error);
  }
}

async function changeRole(userId, newRole) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: newRole });
    console.log(`✓ User ${userId} role changed to ${newRole}`);
    showToast(`✓ User role changed to ${newRole}`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Error changing role:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

async function deleteUser(userId, email) {
  const confirmed = await showConfirmDialog(
    `Are you sure you want to delete user ${email}? This will also delete all their bets.`,
    'Delete User'
  );
  
  if (!confirmed) return;
  
  try {
    // Delete user's bets
    const userBetsQuery = query(collection(db, 'bets'), where('userId', '==', userId));
    const betsSnapshot = await getDocs(userBetsQuery);
    
    const batch = writeBatch(db);
    betsSnapshot.forEach(betDoc => {
      batch.delete(betDoc.ref);
    });
    
    // Delete user document
    batch.delete(doc(db, 'users', userId));
    
    await batch.commit();
    console.log(`✓ User ${email} and their bets deleted`);
    showToast(`✓ User ${email} deleted`, 'success');
    loadUsers();
    loadBets();
  } catch (error) {
    console.error('Error deleting user:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

async function deleteBet(betId) {
  const confirmed = await showConfirmDialog(
    'Are you sure you want to delete this bet?',
    'Delete Bet'
  );
  
  if (!confirmed) return;
  
  try {
    await deleteDoc(doc(db, 'bets', betId));
    console.log('✓ Bet deleted');
    showToast('✓ Bet deleted', 'success');
    loadBets();
    loadDashboardSummary();
  } catch (error) {
    console.error('Error deleting bet:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

/**
 * Bulk action: Delete selected bets
 */
async function bulkDeleteBets() {
  const checkboxes = document.querySelectorAll('.bet-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('No bets selected', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    `Delete ${checkboxes.length} selected bets? This action cannot be undone.`,
    'Delete Bets'
  );
  
  if (!confirmed) return;

  try {
    const batch = writeBatch(db);
    checkboxes.forEach(checkbox => {
      batch.delete(doc(db, 'bets', checkbox.value));
    });
    await batch.commit();
    console.log(`✓ Deleted ${checkboxes.length} bets`);
    showToast(`✓ Deleted ${checkboxes.length} bets`, 'success');
    loadBets();
    loadDashboardSummary();
  } catch (error) {
    console.error('Error in bulk delete:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

/**
 * Bulk action: Change role for selected users
 */
async function bulkChangeUserRole(newRole) {
  const checkboxes = document.querySelectorAll('.user-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast('No users selected', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    `Change role to "${newRole}" for ${checkboxes.length} selected users?`,
    'Change User Role'
  );
  
  if (!confirmed) return;

  try {
    const batch = writeBatch(db);
    checkboxes.forEach(checkbox => {
      batch.update(doc(db, 'users', checkbox.value), { role: newRole });
    });
    await batch.commit();
    console.log(`✓ Changed role for ${checkboxes.length} users`);
    showToast(`✓ Updated ${checkboxes.length} users`, 'success');
    loadUsers();
  } catch (error) {
    console.error('Error in bulk role change:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

/**
 * Calculate advanced analytics
 */
async function loadAnalytics() {
  try {
    const analyticsEl = document.getElementById('analyticsSection');
    if (!analyticsEl) {
      console.log('No analytics section found');
      return;
    }

    const betsSnapshot = await getDocs(collection(db, 'bets'));
    
    // Initialize tracking objects
    const trackStats = {};
    const betTypeStats = {};
    let totalProfit = 0;
    let settledBets = 0;
    const allBets = [];

    betsSnapshot.forEach(doc => {
      const bet = doc.data();
      const betAmount = Number(bet.betAmount ?? bet.amount ?? 0);
      const winnings = Number(bet.winnings ?? 0);
      const outcome = String(bet.outcome || 'pending').toLowerCase();
      
      allBets.push({ betAmount, winnings, outcome });

      // Track by track
      const track = bet.trackName || 'Unknown';
      if (!trackStats[track]) {
        trackStats[track] = { count: 0, wagered: 0, wins: 0 };
      }
      trackStats[track].count++;
      trackStats[track].wagered += betAmount;
      if (outcome === 'win') trackStats[track].wins++;

      // Track by bet type
      const betType = bet.betType || 'Unknown';
      if (!betTypeStats[betType]) {
        betTypeStats[betType] = { count: 0, wagered: 0, wins: 0 };
      }
      betTypeStats[betType].count++;
      betTypeStats[betType].wagered += betAmount;
      if (outcome === 'win') betTypeStats[betType].wins++;

      // Calculate profit
      if (outcome !== 'pending') {
        settledBets++;
        totalProfit += (winnings - betAmount);
      }
    });

    // Calculate ROI
    const totalWagered = allBets.reduce((sum, b) => sum + b.betAmount, 0);
    const roi = totalWagered > 0 ? ((totalProfit / totalWagered) * 100).toFixed(1) : 0;

    // Find most-used track
    let mostUsedTrack = { name: 'N/A', count: 0, winRate: 0 };
    for (const [track, stats] of Object.entries(trackStats)) {
      if (stats.count > mostUsedTrack.count) {
        mostUsedTrack = { 
          name: track, 
          count: stats.count, 
          winRate: (stats.wins / stats.count * 100).toFixed(1)
        };
      }
    }

    // Create analytics HTML
    let analyticsHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
          <h4>Overall ROI</h4>
          <p style="font-size: 24px; font-weight: bold; color: ${roi >= 0 ? '#27ae60' : '#e74c3c'};">${roi}%</p>
          <small>Profit: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}</small>
        </div>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
          <h4>Most-Used Track</h4>
          <p style="font-size: 20px; font-weight: bold;">${mostUsedTrack.name}</p>
          <small>${mostUsedTrack.count} bets, ${mostUsedTrack.winRate}% win rate</small>
        </div>
      </div>

      <h4 style="margin-top: 25px;">Win Rate by Bet Type</h4>
      <table border="1" style="width: 100%; margin-bottom: 20px;">
        <tr>
          <th>Bet Type</th>
          <th>Count</th>
          <th>Wagered</th>
          <th>Win Rate</th>
        </tr>
    `;

    for (const [betType, stats] of Object.entries(betTypeStats || {})) {
      const winRate = stats.count > 0 ? (stats.wins / stats.count * 100).toFixed(1) : 0;
      analyticsHtml += `
        <tr>
          <td>${betType}</td>
          <td>${stats.count}</td>
          <td>$${stats.wagered.toFixed(2)}</td>
          <td>${winRate}%</td>
        </tr>
      `;
    }

    analyticsHtml += `</table>`;

    analyticsEl.innerHTML = analyticsHtml;
    console.log('✓ Analytics loaded');
    showToast('✓ Analytics refreshed', 'success');
  } catch (error) {
    console.error('Error loading analytics:', error);
    showToast('✗ Failed to load analytics', 'error');
  }
}

/**
 * Export bets to CSV
 */
function exportBetsToCSV() {
  try {
    const table = document.querySelector('#betsTable');
    let csv = 'Timestamp,User ID,Track,Bet Type,Amount,Outcome,Winnings,ROI%\n';

    document.querySelectorAll('#betsTable tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 9) {
        // Skip checkbox (0), extract data
        csv += `"${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent}","${cells[4].textContent}","${cells[5].textContent}","${cells[6].textContent}","${cells[7].textContent}"\n`;
      }
    });

    downloadFile(csv, 'bets.csv', 'text/csv');
    console.log('✓ Bets exported to CSV');
    showToast('✓ Exported as CSV', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

/**
 * Export bets to JSON
 */
async function exportBetsToJSON() {
  try {
    const snapshot = await getDocs(collection(db, 'bets'));
    const bets = [];

    snapshot.forEach(doc => {
      const bet = doc.data();
      bets.push({
        id: doc.id,
        userId: bet.userId,
        trackName: bet.trackName,
        horseName: bet.horseName,
        betType: bet.betType,
        betAmount: bet.betAmount,
        odds: bet.odds,
        payout: bet.payout,
        winnings: bet.winnings,
        outcome: bet.outcome,
        timestamp: bet.timestamp ? bet.timestamp.toDate().toISOString() : null
      });
    });

    const json = JSON.stringify(bets, null, 2);
    downloadFile(json, 'bets.json', 'application/json');
    console.log(`✓ Exported ${bets.length} bets to JSON`);
    showToast(`✓ Exported ${bets.length} bets as JSON`, 'success');
  } catch (error) {
    console.error('Error exporting JSON:', error);
    showToast('✗ Error: ' + error.message, 'error');
  }
}

/**
 * Download file helper
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Expose functions to global scope
window.changeRole = changeRole;
window.deleteUser = deleteUser;
window.deleteBet = deleteBet;
window.bulkDeleteBets = bulkDeleteBets;
window.bulkChangeUserRole = bulkChangeUserRole;
window.loadAnalytics = loadAnalytics;
window.exportBetsToCSV = exportBetsToCSV;
window.exportBetsToJSON = exportBetsToJSON;
