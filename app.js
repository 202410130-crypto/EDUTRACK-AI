/* =============================================
   EDUTRACK AI — APP.JS
   Google Sign-In + domain restriction
   @gordoncollege.edu.ph only
   ============================================= */

const ALLOWED_DOMAIN  = 'gordoncollege.edu.ph';
const ROLE_REDIRECTS  = {
  student:     'student.html',
  teacher:     'teacher.html',
  coordinator: 'coordinator.html',
  admin:       'admin.html'
};

/* ── Email/password fallback state (for admin use) ── */
let selectedRole = 'student';

function selectRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  clearLoginError();
}

/* ── Helpers ── */
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function showLoginError(msg) {
  const box = document.getElementById('loginError');
  const txt = document.getElementById('loginErrorMsg');
  if (box) box.classList.remove('hidden');
  if (txt) txt.textContent = msg;
}

function clearLoginError() {
  const box = document.getElementById('loginError');
  if (box) box.classList.add('hidden');
  const ee = document.getElementById('emailError');
  if (ee) ee.classList.add('hidden');
  const ei = document.getElementById('emailInput');
  if (ei) ei.classList.remove('error');
}

function togglePassword() {
  const i  = document.getElementById('passwordInput');
  const ic = document.getElementById('eyeIcon');
  if (!i) return;
  if (i.type === 'password') {
    i.type = 'text';
    ic.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    i.type = 'password';
    ic.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}

/* =============================================
   GOOGLE SIGN-IN (Primary login method)
   Uses popup on desktop, redirect on mobile
   ============================================= */
function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

async function handleGoogleLogin() {
  clearLoginError();
  const btn     = document.getElementById('googleBtn');
  const btnText = document.getElementById('googleBtnText');

  if (btn)     btn.disabled = true;
  if (btnText) btnText.innerHTML = '<span class="spinner"></span> Signing in…';

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    hd:     ALLOWED_DOMAIN
  });

  try {
    if (isMobile()) {
      // Mobile: use redirect (popup blocked on most mobile browsers)
      await auth.signInWithRedirect(provider);
      // Page will redirect to Google then come back — result handled in DOMContentLoaded
    } else {
      // Desktop: use popup
      const result = await auth.signInWithPopup(provider);
      await handleAuthResult(result.user);
    }
  } catch (err) {
    console.error('Google login error:', err.code, err.message);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      if (btn)     btn.disabled = false;
      if (btnText) btnText.textContent = 'Sign in with Google';
      return;
    }
    const msg = err.code === 'auth/popup-blocked'
      ? 'Popup was blocked. Please allow popups or use a different browser.'
      : err.code === 'auth/network-request-failed'
      ? 'Network error. Please check your internet connection.'
      : 'Sign-in failed. Please try again.';
    showLoginError(msg);
    if (btn)     btn.disabled = false;
    if (btnText) btnText.textContent = 'Sign in with Google';
  }
}

/* Handle auth result — shared by popup and redirect ── */
async function handleAuthResult(firebaseUser) {
  const btn     = document.getElementById('googleBtn');
  const btnText = document.getElementById('googleBtnText');

  const email = firebaseUser.email;

  // Domain restriction
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
    await auth.signOut();
    showLoginError(`Access denied. Only @${ALLOWED_DOMAIN} accounts are allowed. You signed in with: ${email}`);
    if (btn)     btn.disabled = false;
    if (btnText) btnText.textContent = 'Sign in with Google';
    return;
  }

  // Check registration
  const userData = await getUserData(firebaseUser);
  if (!userData) {
    await auth.signOut();
    showLoginError('Your account is not registered in the system yet. Please contact your administrator.');
    if (btn)     btn.disabled = false;
    if (btnText) btnText.textContent = 'Sign in with Google';
    return;
  }

  // Redirect to dashboard
  window.location.href = ROLE_REDIRECTS[userData.role] || 'index.html';
}

/* =============================================
   EMAIL + PASSWORD FALLBACK
   (Hidden under "details" — for admin / testing)
   ============================================= */
async function handleEmailLogin() {
  clearLoginError();
  const email    = (document.getElementById('emailInput')?.value  || '').trim().toLowerCase();
  const password = (document.getElementById('passwordInput')?.value || '').trim();
  const btnText  = document.getElementById('loginBtnText');
  const btn      = document.getElementById('loginBtn');
  const eeEl     = document.getElementById('emailError');
  const eiEl     = document.getElementById('emailInput');

  if (!email) {
    if (eeEl) { eeEl.classList.remove('hidden'); eeEl.textContent = '⚠ Email is required.'; }
    if (eiEl) eiEl.classList.add('error');
    return;
  }
  if (!isValidEmail(email)) {
    if (eeEl) { eeEl.classList.remove('hidden'); eeEl.textContent = '⚠ Enter a valid email address.'; }
    if (eiEl) eiEl.classList.add('error');
    return;
  }

  if (btnText) btnText.innerHTML = '<span class="spinner"></span>';
  if (btn)     btn.disabled = true;

  try {
    const cred     = await auth.signInWithEmailAndPassword(email, password);
    const userData = await getUserData(cred.user);

    if (!userData) {
      await auth.signOut();
      showLoginError('Your account is not registered. Contact your administrator.');
      if (btnText) btnText.textContent = 'Sign In';
      if (btn)     btn.disabled = false;
      return;
    }

    if (userData.role !== selectedRole) {
      await auth.signOut();
      showLoginError(`This is a "${userData.role}" account. Please select the correct role above.`);
      if (btnText) btnText.textContent = 'Sign In';
      if (btn)     btn.disabled = false;
      return;
    }

    window.location.href = ROLE_REDIRECTS[userData.role] || 'index.html';

  } catch (err) {
    const msg =
      err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'
      ? 'Invalid email or password.' :
      err.code === 'auth/too-many-requests'
      ? 'Too many failed attempts. Please wait.' :
      'Login failed. Please try again.';
    showLoginError(msg);
    if (btnText) btnText.textContent = 'Sign In';
    if (btn)     btn.disabled = false;
  }
}

/* =============================================
   FIRESTORE USER DOCUMENT
   ============================================= */

/* Get existing user doc — returns null if not pre-registered */
async function getUserData(firebaseUser) {
  const ref  = db.collection('users').doc(firebaseUser.uid);
  const snap = await ref.get();

  // ── CASE 1: Already an active user ──
  if (snap.exists) {
    const updates = { last_login: firebase.firestore.FieldValue.serverTimestamp() };
    if (firebaseUser.photoURL)   updates.photo_url = firebaseUser.photoURL;
    if (firebaseUser.displayName && !snap.data().name) updates.name = firebaseUser.displayName;
    await ref.update(updates);
    return { uid: snap.id, ...snap.data() };
  }

  // ── CASE 2: Admin bootstrap account ──
  const adminEmails = [
    `admin@${ALLOWED_DOMAIN}`,
    '202410130@gordoncollege.edu.ph'   // ← your actual admin email
  ];
  if (adminEmails.includes(firebaseUser.email)) {
    const adminDoc = {
      uid:        firebaseUser.uid,
      email:      firebaseUser.email,
      name:       firebaseUser.displayName || 'System Administrator',
      role:       'admin',
      dept:       'Administrator',
      section:    '',
      is_active:  true,
      photo_url:  firebaseUser.photoURL || '',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      last_login: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(adminDoc);
    return adminDoc;
  }

  // ── CASE 3: Check pending_users by email (pre-registered by admin) ──
  const pendingRef  = db.collection('pending_users').doc(firebaseUser.email);
  const pendingSnap = await pendingRef.get();

  if (pendingSnap.exists) {
    const pending = pendingSnap.data();

    // Check if account is active
    if (pending.is_active === false) return null;

    // Promote pending user → active user with real Firebase UID
    const newUserDoc = {
      ...pending,
      uid:        firebaseUser.uid,
      email:      firebaseUser.email,
      name:       pending.name || firebaseUser.displayName || '',
      photo_url:  firebaseUser.photoURL || '',
      created_at: pending.created_at || firebase.firestore.FieldValue.serverTimestamp(),
      last_login: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save to users collection with real UID as document ID
    await ref.set(newUserDoc);

    // Remove from pending_users (they're now fully active)
    await pendingRef.delete();

    console.log(`✅ User promoted from pending: ${firebaseUser.email} → role: ${newUserDoc.role}`);
    return newUserDoc;
  }

  // ── CASE 4: Not registered at all ──
  return null;
}

/* =============================================
   AUTH GUARD FOR DASHBOARD PAGES
   ============================================= */
function initPage(expectedRole, onReady) {
  const pc = document.getElementById('pageContent');
  if (pc) pc.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:14px">
      <div class="spinner" style="width:36px;height:36px;border-width:3px;border-color:rgba(46,125,50,0.18);border-top-color:var(--green)"></div>
      <p style="color:var(--text3);font-size:0.86rem">Loading your dashboard…</p>
    </div>`;

  auth.onAuthStateChanged(async (fbUser) => {
    if (!fbUser) { window.location.href = 'index.html'; return; }
    try {
      const userData = await getUserData(fbUser);
      if (!userData) { await auth.signOut(); window.location.href = 'index.html'; return; }
      if (expectedRole && userData.role !== expectedRole) {
        window.location.href = ROLE_REDIRECTS[userData.role] || 'index.html';
        return;
      }
      onReady(userData);
    } catch(e) {
      console.error('initPage error:', e);
      await auth.signOut();
      window.location.href = 'index.html';
    }
  });
}

/* ── Logout ── */
async function logout() {
  try { await auth.signOut(); } catch(e) {}
  window.location.href = 'index.html';
}

/* ── Populate sidebar ── */
function populateSidebar(user) {
  const n = document.getElementById('sidebarUserName');
  const s = document.getElementById('sidebarUserSub');
  const a = document.getElementById('sidebarAvatar');
  const p = document.getElementById('sidebarPhoto');

  if (n) n.textContent = user.name || 'User';
  if (s) s.textContent = user.dept || user.section || '';

  // Show Google profile photo if available
  if (p && user.photo_url) {
    p.src   = user.photo_url;
    p.style.display = 'block';
    if (a) a.style.display = 'none';
  } else if (a) {
    const parts = (user.name || 'U').split(' ');
    a.textContent = parts.map(x => x[0]).join('').slice(0, 2).toUpperCase();
  }
}

/* ── Enter key + redirect result handler ── */
document.addEventListener('DOMContentLoaded', () => {
  const pw = document.getElementById('passwordInput');
  const em = document.getElementById('emailInput');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') handleEmailLogin(); });
  if (em) em.addEventListener('keydown', e => { if (e.key === 'Enter') handleEmailLogin(); });
  if (em) em.addEventListener('input', clearLoginError);

  // Handle redirect result (mobile Google Sign-In comes back here)
  auth.getRedirectResult().then(async (result) => {
    if (!result || !result.user) return;
    const btn     = document.getElementById('googleBtn');
    const btnText = document.getElementById('googleBtnText');
    if (btn)     btn.disabled = true;
    if (btnText) btnText.innerHTML = '<span class="spinner"></span> Signing in…';
    try {
      await handleAuthResult(result.user);
    } catch(e) {
      showLoginError('Sign-in failed. Please try again.');
      if (btn)     btn.disabled = false;
      if (btnText) btnText.textContent = 'Sign in with Google';
    }
  }).catch((err) => {
    if (err.code !== 'auth/no-such-provider') {
      console.error('Redirect result error:', err);
    }
  });

  // If already signed in — redirect immediately
  auth.onAuthStateChanged(async (fbUser) => {
    if (!fbUser) return;
    if (!window.location.pathname.includes('index')) return;
    try {
      const userData = await getUserData(fbUser);
      if (userData) window.location.href = ROLE_REDIRECTS[userData.role] || 'index.html';
    } catch(e) {}
  });
});

/* =============================================
   SHARED UTILITIES
   ============================================= */
function riskBadge(level) {
  const m = { 'Safe':'safe','Slightly At Risk':'slight','Moderately At Risk':'moderate','Critically At Risk':'critical' };
  return `<span class="risk-badge ${m[level]||'safe'}">${level}</span>`;
}
function statusBadge(s) {
  const m = { 'Passing':'passing','Failing':'failing','Conditional Passing':'conditional' };
  return `<span class="status-badge ${m[s]||'passing'}">${s}</span>`;
}
function computeRisk(avg) {
  if (avg >= 88) return 'Safe';
  if (avg >= 80) return 'Slightly At Risk';
  if (avg >= 75) return 'Moderately At Risk';
  return 'Critically At Risk';
}
function computeStatus(avg) {
  if (avg >= 75) return 'Passing';
  if (avg >= 70) return 'Conditional Passing';
  return 'Failing';
}
function sortStudents(arr) {
  return [...arr].sort((a,b) =>
    (a.student_name || a.name || '').localeCompare(b.student_name || b.name || '')
  );
}
function showToast(msg, type = 'success') {
  const t  = document.createElement('div');
  const bg = type === 'error' ? 'var(--critical)' : 'var(--green)';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${bg};color:#fff;padding:12px 20px;border-radius:10px;font-size:0.86rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.18);z-index:999;animation:fadeIn 0.3s ease`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
