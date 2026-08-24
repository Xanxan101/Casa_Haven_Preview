// Casa Haven — ownerpanel.html / staffpanel.html. Which one this is comes
// from <body data-role="owner|staff">.
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  fetchTeamMember, initialsFor, initAdminCalendar, initAdminInteractions,
  initAdminNav, initAdminRates, initStaffRatesSync, renderAdminStaffList,
} from './admin-shared.js';

document.addEventListener('DOMContentLoaded', () => {
  const role = document.body.dataset.role;
  const otherRolePanel = role === 'owner' ? 'staffpanel.html' : 'ownerpanel.html';
  const adminConsole = document.getElementById('admin-console');
  const topbar = adminConsole.querySelector('.admin-topbar');
  const shell = adminConsole.querySelector('.admin-shell');

  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = 'team-login.html'; return; }
    const member = await fetchTeamMember(user.email.toLowerCase());
    if (!member) { window.location.href = 'team-login.html'; return; }
    // Authenticated, but this is the wrong console for their role — send
    // them to the right one instead of just refusing access.
    if (member.role !== role) { window.location.href = otherRolePanel; return; }

    const name = member.name || member.email || '';
    document.getElementById('admin-role-label').textContent = role === 'owner' ? 'Owner console' : 'Staff console';
    document.getElementById('admin-name').textContent = name;
    document.getElementById('admin-role').textContent = role === 'owner' ? 'Owner' : 'Staff';
    document.getElementById('admin-avatar').textContent = initialsFor(name) || '?';

    topbar.hidden = false;
    shell.hidden = false;

    const calendar = initAdminCalendar();
    initAdminInteractions({ role });
    initAdminNav({ onCalendarOpen: calendar.resetToToday });
    if (role === 'owner') {
      renderAdminStaffList();
      initAdminRates();
    } else {
      initStaffRatesSync();
    }
  });
});
