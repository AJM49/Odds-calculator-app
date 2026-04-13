# Dashboard Troubleshooting Guide

## Overview

The dashboard (`dashboard.html`) displays a user's betting history and statistics. It requires:
1. ✅ User to be logged in
2. ✅ Firestore security rules to allow reading bets
3. ✅ Bets to exist in the users' collection

## Dashboard Flow

```
1. User visits dashboard.html
   ↓
2. Firebase initializes and validates
   ↓
3. Authentication state listener fires
   ↓
4. If logged in → Load bets from Firestore
   If not logged in → Redirect to login.html
   ↓
5. Query Firestore for bets where userId == current user's UID
   ↓
6. Render table and update statistics
```

## Testing the Dashboard

### Test 1: Verify Firebase is Working
```
Browser Console (F12):
- Should see: "📊 Dashboard module loaded"
- Should see: "✓ Firebase Firestore object validated successfully"
```

### Test 2: Verify User is Logged In
```
Browser Console (F12):
- Should see: "🔐 onAuthStateChanged callback fired"
- Should see: "✅ User authenticated, currentUserId set to: [USER_ID]"
- Dashboard status should show "Loading your bets..."

If instead you see:
- "No user logged in" → Go to login.html and login first
```

### Test 3: Verify Bets are Loading
```
Browser Console (F12):
- Should see: "📋 loadBets() called with userId: [USER_ID]"
- Should see: "🚀 fetchAndRenderBets() started"
- Should see: "✓ getDocs() returned successfully"
- Should see: "Found N bets"
```

### Test 4: Verify Rendering
```
Browser Console (F12):
- Should see: "✓ Data transformation complete"
- Should see: "✓ renderBetsTable() completed"
- Should see: "✓ Bets loaded successfully"

If table is empty:
- Check Firestore Console → bets collection
- Verify bets have: userId, horseName, trackName, betType, betAmount, outcome, winnings, timestamp
```

## Common Issues & Solutions

### Issue 1: "Redirecting to login..." on Dashboard

**Symptom:** Dashboard immediately redirects to login.html

**Cause:** User session expired or not logged in

**Solution:**
1. Go to login.html
2. Create a test account or login with existing account
3. Then access dashboard.html

---

### Issue 2: "Loading bets..." never completes

**Symptom:** Dashboard shows "Loading bets..." forever

**Cause:** Firestore query is hanging (usually permissions)

**Console Output:**
```
✓ Query built, executing...
[nothing after this]
```

**Solution:**
1. Check Firestore Security Rules in Firebase Console
2. Rules must allow authenticated users to read their own bets:
```javascript
match /bets/{document=**} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow write: if request.auth != null && request.auth.uid == resource.data.userId;
}
```
3. Or for development (NOT production):
```javascript
match /bets/{document=**} {
  allow read, write: if request.auth != null;
}
```

---

### Issue 3: "Error: permission-denied"

**Symptom:** Red error text in table: "Error: Permission Denied"

**Cause:** Firestore security rules blocking the read

**Console Output:**
```
Error code: permission-denied
```

**Solution:**
Same as Issue 2 - update Firestore security rules

---

### Issue 4: Empty table with "No bets recorded yet"

**Symptom:** Dashboard loads but shows empty table

**Cause:** User has no bets in Firestore

**Console Output:**
```
✓ Query executed successfully
Found 0 bets
```

**Solution:**
1. Go to index.html (calculator)
2. Submit a test bet using the form
3. Return to dashboard.html
4. Table should now show the bet(s)

---

### Issue 5: "table body element not found"

**Symptom:** Blank page or error about missing element

**Console Output:**
```
❌ ERROR: betsTableBody element not found in DOM!
```

**Cause:** HTML element `<tbody id="betsTableBody">` is missing or wrong ID

**Solution:**
Check dashboard.html has:
```html
<table>
  <thead>...</thead>
  <tbody id="betsTableBody"></tbody>
</table>
```

---

## Debug Logging Features

The dashboard now includes comprehensive logging with emoji prefixes for easy scanning:

| Prefix | Meaning |
|--------|---------|
| 📊 | Dashboard module events |
| 🔍 | Initial checks |
| 🔐 | Authentication |
| 📋 | Bets loading |
| 🚀 | Data fetching |
| ✅ | Success steps |
| ❌ | Error steps |

Example complete flow:
```
📊 Dashboard module loaded
✓ Firebase Firestore object validated successfully
🔐 onAuthStateChanged callback fired
✅ User authenticated, currentUserId set to: abc123xyz
📋 loadBets() called with userId: abc123xyz
🚀 fetchAndRenderBets() started
✓ Query built, executing...
✓ getDocs() returned successfully
Found 5 bets
✓ Data transformation complete
✓ renderBetsTable() completed
✓ Bets loaded successfully
```

## Quick Diagnostic Steps

1. **Open F12 → Console tab**
2. **Refresh dashboard.html (Ctrl+F5)**
3. **Scroll through console output**
4. **Find the first ❌ ERROR message**
5. **Check the "Common Issues" table above**

## Performance Notes

- Dashboard queries max 100 bets per load (configurable)
- Sorting is by timestamp descending (newest first)
- No real-time listeners (refresh button reloads data)
- Stats calculated client-side from loaded bets

## Security Notes

Dashboard respects Firestore security rules:
- Users can only see their own bets (filtered by userId)
- Rules are enforced at database level
- No privilege escalation possible

## File Structure

```
dashboard.html         # UI markup
dashboard.js           # Logic (imports Firebase via ES6 modules)
dashboard.css          # Styling
firebase.js            # Firestore initialization & exports
```

## Debugging Checklist

- [ ] Refresh page with Ctrl+F5 (hard refresh)
- [ ] User is logged in (check auth message)
- [ ] Firestore security rules allow reads
- [ ] At least one bet exists in Firestore
- [ ] Check browser console for errors (F12)
- [ ] Check network tab for failed requests
- [ ] Verify Firebase project is correct
- [ ] Check browser compatibility (requires ES6 modules)

