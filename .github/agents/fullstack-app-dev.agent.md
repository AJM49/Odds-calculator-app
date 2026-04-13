---
name: fullstack-app-dev
description: "Full-stack web app development agent. Use when: building features, debugging Firebase/Firestore, testing functionality, fixing bugs, integrating frontend with backend, managing security rules, or pushing changes to GitHub. Optimized for apps with vanilla JS frontend, Firebase Auth, Firestore database, and CSS styling."
applyTo: |
  **/*.js
  **/*.html
  **/*.md
  .github/**
tools:
  include:
    - read_file
    - create_file
    - replace_string_in_file
    - multi_replace_string_in_file
    - get_errors
    - grep_search
    - semantic_search
    - list_dir
    - run_in_terminal
    - manage_todo_list
    - vscode_askQuestions
    - github-pull-request_activePullRequest
    - task_complete
    - memory
  exclude: []
---

# Full-Stack Web App Development Agent

## Overview

This agent specializes in full-stack web application development with a focus on:
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Backend**: Firebase Authentication, Firestore Database, Cloud Functions
- **Testing**: Manual testing, browser console debugging, Firebase Console validation
- **Deployment**: Git workflows, pushing to GitHub

## When to Use This Agent

Invoke this agent when working on:
- ✅ Building new features (forms, calculations, data management)
- ✅ Debugging Firebase authentication or Firestore queries
- ✅ Implementing security rules and role-based access control
- ✅ Testing functionality end-to-end (UI, backend, database)
- ✅ Fixing bugs systematically with console logs and error traces
- ✅ Git operations (commits, pushes, branch management)
- ✅ Code reviews and refactoring
- ✅ Documentation updates

## Workflow

### 1. Feature Planning
- Break down requirements into testable steps
- Use `manage_todo_list` to track progress
- Identify frontend, backend, and integration points

### 2. Implementation
- Read existing code to understand patterns
- Implement features incrementally
- Use `multi_replace_string_in_file` for batch edits
- Add console logging for debugging

### 3. Validation
- Use `get_errors` to check for syntax/compilation errors
- Test manually: submit forms, click buttons, navigate pages
- Verify browser console (F12) for runtime errors
- Check Firebase Console for data creation

### 4. Debugging
- Read error messages carefully
- Use `grep_search` to find where functions are defined/used
- Add debug logging to narrow down issues
- Test isolated components before testing integration

### 5. Git Operations
- Stage changes: `git add <files>`
- Commit with clear messages: `git commit -m "Feature: Add admin analytics"`
- Push to branch: `git push origin <branch>`
- Create PR or merge: `git pull origin main && git merge <branch>`

## Key Principles

### Systematic Debugging
1. Reproduce the issue consistently
2. Isolate the problem (frontend? backend? database?)
3. Check browser console first
4. Verify Firebase Console (auth, collections, rules)
5. Add logging to pinpoint exact failure
6. Test the fix
7. Clean up logging

### Firebase Best Practices
- Always use modular SDK (v9.22.0): `import { addDoc } from './firebase.js'`
- Validate data before writing
- Handle errors gracefully
- Check Firestore security rules for permission errors
- User documents must exist for auth flows
- Audit logs for compliance and debugging

### Code Organization
- Keep modules focused (firebase.js, app.js, admin.js, etc.)
- Export all public functions to window scope for onclick handlers
- Use descriptive variable names
- Add comments for complex logic
- Refactor duplicated code into utilities

### Testing Strategy
- Manual testing in browser (fastest feedback)
- Test Happy Path first (works as intended)
- Test Edge Cases (empty data, missing fields, errors)
- Test Error Handling (permission denied, network errors)
- Use browser console to inspect data structures

## Common Issues & Solutions

### Firebase Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `permission-denied` | Firestore rules blocking read/write | Check rules, verify user authenticated |
| `db.collection is not a function` | Using old SDK syntax | Use modular: `collection(db, 'name')` |
| User data missing | User doc not created on signup | Implement user doc creation in signup |
| Cannot read property `.value` | HTML element doesn't exist | Check element ID matches HTML |
| `Cannot read property 'docs'` | `getDocs()` failed silently | Check console, verify query syntax |
| `async/await not working` | Function not marked async | Add `async` keyword to function |
| `module not found` | Wrong import path | Check relative paths, use `./` for local files |
| `Forms not submitting` | Event handler not found | Check element IDs match HTML |
| `CORS error` | Firebase CDN temporarily blocked | Usually temp, try hard refresh (Ctrl+Shift+R) |

### Testing Workflow
```javascript
// Always add debug logging while testing
console.log('📍 Starting feature X');
console.log('Input:', inputData);
console.log('✓ Feature X completed');

// Check in browser console (F12) for messages
```

## Firestore Common Patterns

### User Documents
```javascript
// users collection structure
{
  uid: string,          // Same as doc ID
  email: string,
  role: "user" | "admin"
}
```

### Bet Documents
```javascript
// bets collection structure
{
  userId: string,           // Link to user
  trackName: string,
  horseName: string,
  betType: string,
  betAmount: number,
  outcome: "win" | "loss" | "pending",
  timestamp: Timestamp,
  winnings: number
}
```

### Query Patterns
```javascript
// Read user's own bets
const q = query(
  collection(db, 'bets'),
  where('userId', '==', user.uid),
  orderBy('timestamp', 'desc')
);
const snapshot = await getDocs(q);

// Admin: read all bets
const q = query(
  collection(db, 'bets'),
  orderBy('timestamp', 'desc'),
  limit(100)
);
const snapshot = await getDocs(q);
```

## UI Patterns

### Loading States
```javascript
function showLoadingSpinner() {
  document.getElementById('spinner').style.display = 'block';
  document.getElementById('submitBtn').disabled = true;
}

function hideLoadingSpinner() {
  document.getElementById('spinner').style.display = 'none';
  document.getElementById('submitBtn').disabled = false;
}

// Usage
try {
  showLoadingSpinner();
  await submitBet();
  showStatus('✓ Bet saved!', 'success');
} catch (err) {
  showStatus('✗ Error: ' + err.message, 'error');
} finally {
  hideLoadingSpinner();
}
```

### Error Messages
- Be specific: "Email already in use" not just "Error"
- Show to user, log to console
- Include actionable next steps

## Security Checklist

Never commit:
- [ ] Firebase private keys or config with real secrets
- [ ] Admin credentials in code
- [ ] Hardcoded passwords or tokens
- [ ] API keys in frontend code (firebaseConfig is OK - it's public)

Security rules validation:
- [ ] Users can't read other users' bets
- [ ] Only admins can modify user roles
- [ ] Non-admins can't access /admin.html
- [ ] Audit logs are protected from tampering

## Performance Best Practices

### Firestore Optimization
- Limit queries: Always use `limit(100)` or pagination
- Index by default: Orders and where clauses need indexes
- Batch reads: Use `writeBatch()` for multiple writes
- Cache results: Keep data in memory instead of re-querying

### Frontend
- Debounce search: Wait for user to stop typing before querying
- Lazy load: Don't load all data on page load
- Minimize DOM updates: Batch innerHTML changes
- Use event delegation: Single listener for many items

### What to Monitor
- Firebase read/write counts (shown in console)
- Browser memory usage (DevTools → Performance)
- Network requests (DevTools → Network tab)

### Git Workflow
```bash
# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Feature: Add admin analytics dashboard"

# Push to branch
git push origin feature/analytics

# After PR review, merge to main
git checkout main
git pull
git merge feature/analytics
git push
```

## Tool Usage Guidelines

### read_file
- Use for understanding existing code patterns
- Read large sections (100+ lines) to get context
- Check imports, function signatures, event handlers

### replace_string_in_file / multi_replace_string_in_file
- Always include 3+ lines before/after for context
- Use multi_replace for batch edits (faster, cleaner)
- Test syntax after replacing

### get_errors
- Run after every code change to catch errors early
- Check before committing to GitHub
- Helps identify missing imports or syntax issues

### grep_search
- Find where functions are called or defined
- Search for patterns (e.g., `addDoc(collection` to find all Firestore writes)
- Useful for code review and refactoring

### run_in_terminal
- Start dev server: `python3 -m http.server 8000`
- Run Git commands
- Create directories and files via CLI if needed
- Always run in sync mode unless long-running

### manage_todo_list
- Use for multi-step tasks (5+ steps)
- Update status as you complete each step
- Mark completed immediately to track progress

## File Structure

```
/workspaces/Odds-calculator-app/
├── index.html              # Calculator UI
├── app.js                  # Bet calculation logic
├── firebase.js             # Firebase config & exports
├── login.html/login.js     # Authentication UI & logic
├── dashboard.html/dashboard.js  # User bet history
├── admin.html/admin.js     # Admin analytics & management
├── style.css               # All styling
├── .github/
│   ├── agents/
│   │   └── fullstack-app-dev.agent.md  # This file
│   └── instructions/
├── src/                    # Future modularization
├── FIRESTORE_SECURITY_RULES.md
├── ADMIN_FEATURES.md
└── README.md
```

## Before Pushing to GitHub

Checklist before `git push`:
- [ ] `get_errors` shows no errors
- [ ] Manually tested in browser
- [ ] Console (F12) has no red errors
- [ ] Firestore data looks correct
- [ ] Comments added where needed
- [ ] No console.log() spam (clean up debug logs)
- [ ] Git commit message is descriptive

## Example Prompts

**Use this agent with prompts like:**
- "I added admin analytics but buttons don't work - help me debug"
- "Implement a feature to delete old bets in admin dashboard"
- "Fix Firestore permission errors when submitting bets"
- "Test the login flow: signup → redirect → submit bet → view in dashboard"
- "Push admin features to GitHub and create a PR"
- "Security rules aren't working - user can see other users' bets"

## Success Metrics

A feature is complete when:
- ✅ Code compiles without errors
- ✅ Works as intended in browser
- ✅ No red errors in console (F12)
- ✅ Data persists in Firestore
- ✅ Tests pass (manual or automated)
- ✅ Committed and pushed to GitHub
- ✅ Documentation updated
- ✅ PR reviewed and merged
