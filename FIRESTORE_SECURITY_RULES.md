# Firestore Security Rules Configuration

## Overview

This document defines the security rules for the Horse Odds Calculator. Rules protect user data, enable admin functionality, and allow audit logging.

## Current Rules

### Step 1: Go to Firebase Console
1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **horse-bet-calculator**
3. Go to **Firestore Database** (left sidebar)

### Step 2: Update Security Rules
1. Click the **Rules** tab at the top
2. Replace the entire content with the rules below:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function: Check if user is admin
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function: Check if user owns this document
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // ===== USERS COLLECTION =====
    match /users/{userId} {
      // Each user can read their own document
      allow read: if request.auth != null && isOwner(userId);
      
      // Admins can read all user documents (for user management)
      allow read: if isAdmin();
      
      // Only admins can write to user documents (change roles, etc.)
      allow write: if isAdmin();
      
      // Users can create their own document (on signup)
      allow create: if request.auth != null && isOwner(userId);
      
      // Users can update their own document (profile changes)
      allow update: if request.auth != null && isOwner(userId);
    }

    // ===== BETS COLLECTION =====
    match /bets/{document=**} {
      // Users can read their own bets
      allow read: if request.auth != null && isOwner(resource.data.userId);
      
      // Admins can read all bets (for analytics and management)
      allow read: if isAdmin();
      
      // Users can create bets
      allow create: if request.auth != null && isOwner(request.resource.data.userId);
      
      // Users can only update/delete their own bets
      allow update, delete: if request.auth != null && isOwner(resource.data.userId);
      
      // Admins can delete any bet (for management)
      allow delete: if isAdmin();
    }

    // ===== AUDIT LOGS COLLECTION =====
    match /auditLogs/{document=**} {
      // Users can read their own audit logs
      allow read: if request.auth != null && isOwner(resource.data.userId);
      
      // Admins can read all audit logs (for compliance)
      allow read: if isAdmin();
      
      // Anyone authenticated can create audit logs (automatic on bet submission)
      allow create: if request.auth != null;
      
      // Admins can delete old audit logs (archiving)
      allow delete: if isAdmin();
    }

  }
}
```

### Step 3: Publish Rules
1. Click **Publish** button
2. Confirm the publication

## Rule Explanation

### Helper Functions

```javascript
// Check if current user is admin (role field in their users document)
function isAdmin() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Check if user owns this document (userId matches authenticated user)
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

### Users Collection (`/users/{userId}`)

| Operation | Owner | Non-Owner | Admin |
|-----------|-------|-----------|-------|
| read | ✅ | ❌ | ✅ |
| write | ✅ own only | ❌ | ✅ |
| delete | ✅ own only | ❌ | ✅ |

**Use Case**: User management, role assignment

### Bets Collection (`/bets/{id}`)

| Operation | Owner | Non-Owner | Admin |
|-----------|-------|-----------|-------|
| read | ✅ | ❌ | ✅ |
| create | ✅ own bets | ❌ | ✅ |
| update | ✅ own only | ❌ | ❌ |
| delete | ✅ own only | ❌ | ✅ |

**Use Case**: Bet submission, user dashboard, admin management

### Audit Logs Collection (`/auditLogs/{id}`)

| Operation | Owner | Non-Owner | Admin |
|-----------|-------|-----------|-------|
| read | ✅ own logs | ❌ | ✅ |
| create | ✅ | ✅ | ✅ |
| delete | ❌ | ❌ | ✅ |

**Use Case**: Compliance tracking, bet submission logging, admin review

## Security Model

### Authentication
- All operations require `request.auth != null` (user must be logged in)
- Uses Firebase Auth UID for user identification

### Authorization Levels

**Unauthenticated Users**
- ❌ No access to any data
- Redirected to login.html

**Regular Users**
- ✅ Read/write their own bets
- ✅ Read their own profile
- ✅ Read their own audit logs
- ❌ Cannot access other users' data
- ❌ Cannot access admin features

**Admin Users**
- ✅ Read all users (for user management)
- ✅ Read all bets (for analytics)
- ✅ Read all audit logs (for compliance)
- ✅ Modify user roles
- ✅ Delete any bet (for corrections)
- ✅ Delete audit logs (for archiving)

## Implementation Details

### User Creation (Signup)

When a user signs up via `login.js`, create a user document:

```javascript
import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// After createUserWithEmailAndPassword succeeds
await addDoc(collection(db, "users"), {
  uid: user.uid,
  email: user.email,
  role: "user"  // Default role
});
```

**Note**: Current signup in login.js doesn't create a user document. Consider adding this for full functionality.

### Admin Creation

To create the first admin user (before any rules are enforced):

1. In Firebase Console Firestore, manually create document:
   ```
   Collection: users
   Document ID: <user_uid>
   Fields:
     - uid: <user_uid>
     - email: <user_email>
     - role: "admin"
   ```

2. Or temporarily relax rules, create user document via app, then restore rules.

## Testing Rules

### Test Case 1: User Can Read Own Bets
- User A logs in
- Tries to read `/bets/` with query `where userId == userA.uid`
- ✅ Should succeed

### Test Case 2: User Cannot Read Other User's Bets
- User A logs in
- Tries to read `/bets/` with query `where userId == userB.uid`
- ❌ Should fail with "permission-denied"

### Test Case 3: User Can Create Own Bet
- User A logs in
- Creates bet with `userId: userA.uid`
- ✅ Should succeed

### Test Case 4: User Cannot Create Bet for Another User
- User A logs in
- Tries to create bet with `userId: userB.uid`
- ❌ Should fail (create rule checks request.resource.data.userId)

### Test Case 5: Admin Can See All Bets
- Admin user logs in
- Queries `/bets/` without userId filter
- ✅ Should return all bets

### Test Case 6: User Cannot Query Without userId
- User A logs in
- Tries to query `/bets/` without filtering by userId
- ❌ Should fail (read rule requires `isOwner()`)

## Common Issues & Solutions

### Issue: "Missing or insufficient permissions" when loading dashboard
**Cause**: User can't read their own bets
**Solution**: Check that rule includes `isOwner(resource.data.userId)` for bets read access

### Issue: "Missing or insufficient permissions" when submitting bets
**Cause**: User can't create bets or bets collection not accessible
**Solution**: If creating audit logs, that might fail independently. Check audit log rules allow create.

### Issue: Admin sees blank tables
**Cause**: `isAdmin()` function not working
**Solution**: 
1. Verify user has `role: "admin"` in `/users/{uid}`
2. Check that `isAdmin()` function can read user document (recursive rule issue)

### Issue: Circular permission dependency
If `isAdmin()` tries to read user document but user doc also needs write permission...
**Solution**: Use firestore rules as written - `isAdmin()` is allowed to read user documents.

## Production Recommendations

1. **Regular Audits**: Review audit logs regularly for suspicious activity
2. **Role Management**: Only grant admin access to trusted staff
3. **Backup**: Regularly export data before major changes
4. **Testing**: Always test rules in Firestore Test Rules interface before publishing
5. **Monitor**: Enable Firestore audit logs in Firebase Console

## Migration from Old Rules

If you had different rules before, you may need to:

1. Update user documents to have `role` field
   - Create Cloud Function or manually update
   - Default role should be "user"

2. Populate existing users collection if new
   - If users were only in Auth, create Firestore docs

3. Test thoroughly before publishing to production
   - Use Firestore Rules Testing interface
   - Test with real user IDs

## References

- [Firebase Firestore Security Rules Doc](https://firebase.google.com/docs/firestore/security/start)
- [Firestore Rules Testing Guide](https://firebase.google.com/docs/firestore/security/test-rules-explorer)
- [Common Patterns](https://firebase.google.com/docs/firestore/security/rules-patterns)


✅ Users can create new bets with their own userId  
✅ Users cannot access other users' bets  

## Testing After Rules Update

1. Reload the dashboard: `http://localhost:8000/dashboard.html`
2. Open browser console: **F12 → Console**
3. You should see:
   - ✓ Firebase initialization complete
   - ✓ Query built, executing...
   - ✓ Query executed successfully
   - ✓ Bets loaded successfully

4. If you still see permission errors:
   - Verify you're logged in with a valid account
   - Check that the user's `uid` matches the `userId` field in bet documents
   - Wait 30 seconds for rule propagation (sometimes takes time)
   - Try incognito/private browser mode

## Important: Never Use Public Rules in Production

❌ **DO NOT use these wide-open rules in production:**
```javascript
match /bets/{document=**} {
  allow read, write: if true;  // DANGEROUS - allows anyone to read/modify all data
}
```

## Database Collection Names

Make sure your bets are saved in a collection named **`bets`** with the following structure:

```
bets/
  ├── document-id/
  │   ├── userId: "user-uid-here"
  │   ├── horseName: "Horse Name"
  │   ├── trackName: "Track Name"
  │   ├── betType: "Win"
  │   ├── betAmount: 50
  │   ├── outcome: "won" | "lost" | "pending"
  │   ├── winnings: 100
  │   └── timestamp: [timestamp]
```

## Debugging

If bets still don't load:

1. **Check Console Output** (F12 → Console)
   - Look for "🔐 FIRESTORE SECURITY ERROR" message
   - Note the error code

2. **Verify User Authentication**
   - Are you logged in?
   - Is the login page working?

3. **Verify Bet Documents Exist**
   - Go to Firebase Console → Firestore Database → Collections
   - Check if the `bets` collection exists
   - Check if bet documents have the correct `userId` field

4. **Check Security Rules**
   - Go to Firebase Console → Firestore Database → Rules tab
   - Verify rules match the configuration above
   - Check there are no syntax errors (red X in console)

## Still Having Issues?

The error message in the app should now tell you:
- The error code (e.g., "permission-denied")
- What security rules you need
- Instructions for fixing it

Check the browser console (F12) for the detailed error message.
