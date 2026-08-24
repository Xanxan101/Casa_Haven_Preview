// Casa Haven — team-login.html
import { auth } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { fetchTeamMember } from './admin-shared.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('admin-login');
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-login-email');
  const passwordInput = document.getElementById('admin-login-password');
  const errorEl = document.getElementById('admin-login-error');

  function panelUrlFor(role) {
    return role === 'owner' ? 'ownerpanel.html' : 'staffpanel.html';
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const genericError = 'Incorrect email/password, or this account isn’t registered for the private console.';
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const member = await fetchTeamMember(email);
      if (!member) {
        await signOut(auth);
        errorEl.textContent = genericError;
        errorEl.hidden = false;
        return;
      }
      window.location.href = panelUrlFor(member.role);
    } catch (err) {
      errorEl.textContent = genericError;
      errorEl.hidden = false;
    }
  });

  // Already signed in with a registered team account (e.g. came back to this
  // page with a live session) — skip straight to their console instead of
  // making them sign in again.
  onAuthStateChanged(auth, async user => {
    if (!user) { loginSection.hidden = false; return; }
    const member = await fetchTeamMember(user.email.toLowerCase());
    if (member) { window.location.href = panelUrlFor(member.role); return; }
    loginSection.hidden = false;
  });
});
