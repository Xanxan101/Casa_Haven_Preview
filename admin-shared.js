// Casa Haven — shared logic for the private admin pages (team-login.html,
// ownerpanel.html, staffpanel.html). Behavior here is unchanged from the
// single-page admin console it was extracted from; only the page-per-role
// wiring in admin-login.js / admin-panel.js is new.
import { auth, db } from './firebase.js';
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { fetchAvailabilityMap, setAvailabilityStatus } from './availability.js';
import { fetchRates, saveRates, subscribeToRates, defaultRates } from './rates.js';

export function initialsFor(name) {
  return name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

export async function fetchTeamMember(email) {
  const snap = await getDoc(doc(db, 'team', email));
  return snap.exists() ? snap.data() : null;
}

export function getManilaToday() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const adminDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

let toastTimer;
export function showAdminToast(message) {
  const adminToast = document.getElementById('admin-toast');
  if (!adminToast) return;
  adminToast.textContent = message;
  adminToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => adminToast.classList.remove('show'), 2600);
}

export async function renderAdminStaffList() {
  const list = document.getElementById('admin-staff-list');
  if (!list) return;
  const snap = await getDocs(query(collection(db, 'team'), where('role', '==', 'staff')));
  if (snap.empty) { list.innerHTML = '<p class="admin-lede">No staff accounts registered yet.</p>'; return; }
  list.innerHTML = snap.docs.map(d => {
    const data = d.data();
    return `<div><b>${data.name || data.email}</b><span>${data.email}</span><button type="button" class="admin-btn danger" data-admin-remove-staff="${data.email}">Remove access</button></div>`;
  }).join('');
}

// Calendar render + Start/End Date range picker + month nav + day selection.
// Call once after the console is revealed; wires its own events and does an
// initial render.
export function initAdminCalendar() {
  const adminConsole = document.getElementById('admin-console');
  const adminToday = getManilaToday();
  let adminMonth = new Date(adminToday.getFullYear(), adminToday.getMonth(), 1);
  const adminBooked = new Set();
  const adminClosed = new Set();
  const adminSelectedDates = new Set();

  function renderAdminCalendar() {
    const grid = document.getElementById('admin-calendar');
    const label = document.getElementById('admin-month');
    const summary = document.getElementById('admin-calendar-summary');
    if (!grid || !label || !summary) return;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const first = new Date(adminMonth.getFullYear(), adminMonth.getMonth(), 1);
    const days = new Date(adminMonth.getFullYear(), adminMonth.getMonth() + 1, 0).getDate();
    const dateKey = adminDateKey;
    const todayKey = dateKey(adminToday);
    let booked = 0, closed = 0, open = 0, cells = '';
    // getDay() is Sunday-indexed (0=Sun); shift so the grid's week starts Monday.
    const leadingBlanks = (first.getDay() + 6) % 7;
    for (let i = 0; i < leadingBlanks; i += 1) cells += '<span aria-hidden="true"></span>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(adminMonth.getFullYear(), adminMonth.getMonth(), day);
      const key = dateKey(date);
      const past = date < new Date(adminToday.getFullYear(), adminToday.getMonth(), adminToday.getDate());
      const state = adminBooked.has(key) ? 'booked' : adminClosed.has(key) ? 'closed' : '';
      if (past) cells += `<button type="button" class="admin-day past" disabled>${day}</button>`;
      else {
        if (state === 'booked') booked += 1; else if (state === 'closed') closed += 1; else open += 1;
        const selected = adminSelectedDates.has(key) ? ' is-selected' : '';
        cells += `<button type="button" class="admin-day ${state}${selected}" data-admin-date="${key}" aria-label="${key} ${state || 'open'}">${day}</button>`;
      }
      if (key === todayKey) cells = cells.replace(`data-admin-date="${key}"`, `data-admin-date="${key}" data-today="true"`);
    }
    grid.innerHTML = cells;
    label.textContent = `${monthNames[adminMonth.getMonth()]} ${adminMonth.getFullYear()}`;
    summary.textContent = `${booked} booked · ${closed} closed · ${open} still open`;
  }

  const statusSelect = document.getElementById('admin-calendar-status-select');
  const rangeStartInput = document.getElementById('admin-calendar-range-start');
  const rangeEndInput = document.getElementById('admin-calendar-range-end');

  function clearAdminRangeInputs() {
    if (rangeStartInput) rangeStartInput.value = '';
    if (rangeEndInput) rangeEndInput.value = '';
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
      const status = statusSelect.value;
      const keys = Array.from(adminSelectedDates);
      const count = keys.length;
      keys.forEach(key => {
        adminBooked.delete(key);
        adminClosed.delete(key);
        if (status === 'booked') adminBooked.add(key);
        else if (status === 'closed') adminClosed.add(key);
      });
      adminSelectedDates.clear();
      clearAdminRangeInputs();
      renderAdminCalendar();
      statusSelect.value = '';
      statusSelect.disabled = true;
      try {
        await setAvailabilityStatus(keys, status);
        showAdminToast(`${count} date${count === 1 ? '' : 's'} marked ${status}. Live on the booking page.`);
      } catch (err) {
        showAdminToast('Marked here, but saving to the site failed — check your connection and try again.');
      } finally {
        statusSelect.disabled = false;
      }
    });
  }

  // Start Date / End Date range picker — an alternative to tapping individual days,
  // it lively-selects the whole range on the calendar above as either field changes.
  if (rangeStartInput && rangeEndInput) {
    const todayKey = adminDateKey(adminToday);
    rangeStartInput.min = todayKey;
    rangeEndInput.min = todayKey;
    const applyAdminRange = () => {
      const startVal = rangeStartInput.value;
      const endVal = rangeEndInput.value;
      if (!startVal) return;
      const startDate = new Date(`${startVal}T00:00:00`);
      const endDate = endVal ? new Date(`${endVal}T00:00:00`) : startDate;
      const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
      const todayMidnight = new Date(adminToday.getFullYear(), adminToday.getMonth(), adminToday.getDate());
      adminSelectedDates.clear();
      for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
        if (cursor >= todayMidnight) adminSelectedDates.add(adminDateKey(cursor));
      }
      adminMonth = new Date(from.getFullYear(), from.getMonth(), 1);
      renderAdminCalendar();
    };
    rangeStartInput.addEventListener('input', () => {
      if (rangeEndInput.value && rangeEndInput.value < rangeStartInput.value) rangeEndInput.value = rangeStartInput.value;
      rangeEndInput.min = rangeStartInput.value || todayKey;
      applyAdminRange();
    });
    rangeEndInput.addEventListener('input', applyAdminRange);
  }

  adminConsole.addEventListener('click', event => {
    const dateButton = event.target.closest('[data-admin-date]');
    if (dateButton) {
      const key = dateButton.dataset.adminDate;
      if (adminSelectedDates.has(key)) adminSelectedDates.delete(key);
      else adminSelectedDates.add(key);
      renderAdminCalendar();
      return;
    }
    const clearSelection = event.target.closest('[data-clear-selection]');
    if (clearSelection) { adminSelectedDates.clear(); clearAdminRangeInputs(); renderAdminCalendar(); return; }
    const shift = event.target.closest('[data-calendar-shift]');
    if (shift) { adminSelectedDates.clear(); clearAdminRangeInputs(); adminMonth.setMonth(adminMonth.getMonth() + Number(shift.dataset.calendarShift)); renderAdminCalendar(); return; }
    const today = event.target.closest('[data-calendar-today]');
    if (today) { adminSelectedDates.clear(); clearAdminRangeInputs(); adminMonth = new Date(adminToday.getFullYear(), adminToday.getMonth(), 1); renderAdminCalendar(); }
  });

  function resetToToday() {
    adminMonth = new Date(adminToday.getFullYear(), adminToday.getMonth(), 1);
    adminSelectedDates.clear();
    clearAdminRangeInputs();
    renderAdminCalendar();
  }

  renderAdminCalendar();

  // Load whatever's already booked/closed (set from here or from the other
  // console — owner and staff share the same live data) once Firestore
  // answers, then redraw with it.
  fetchAvailabilityMap().then(map => {
    Object.entries(map).forEach(([key, status]) => {
      if (status === 'booked') adminBooked.add(key);
      else if (status === 'closed') adminClosed.add(key);
    });
    renderAdminCalendar();
  });

  return { resetToToday };
}

// Everything else the console needs once revealed: staff register/remove
// (owner-only — no-ops on staffpanel.html since that markup doesn't exist
// there), promo/inquiry tabs, approval actions, generic toast buttons, and
// sign-out.
export function initAdminInteractions({ role }) {
  const adminConsole = document.getElementById('admin-console');

  if (role === 'owner') {
    const registerStaffButton = document.getElementById('admin-register-staff');
    const staffNameInput = document.getElementById('admin-staff-name');
    const staffEmailInput = document.getElementById('admin-staff-email');
    const staffPasswordInput = document.getElementById('admin-staff-password');
    if (registerStaffButton && staffEmailInput) {
      registerStaffButton.addEventListener('click', async () => {
        const name = staffNameInput.value.trim();
        const email = staffEmailInput.value.trim().toLowerCase();
        const password = staffPasswordInput.value;
        if (!name) { showAdminToast('Enter the staff member’s name.'); return; }
        if (!email || !email.includes('@')) { showAdminToast('Enter a valid staff email.'); return; }
        if (password.length < 6) { showAdminToast('Temporary password must be at least 6 characters.'); return; }
        registerStaffButton.disabled = true;
        // Creating the account through a second, throwaway app instance keeps
        // the owner's own signed-in session untouched — the default
        // createUserWithEmailAndPassword call would otherwise sign the owner
        // out and into the brand-new staff account instead.
        const provisionApp = initializeApp(firebaseConfig, `admin-provision-${Date.now()}`);
        const provisionAuth = getAuth(provisionApp);
        try {
          await createUserWithEmailAndPassword(provisionAuth, email, password);
          await signOut(provisionAuth);
          await setDoc(doc(db, 'team', email), { name, email, role: 'staff', addedAt: serverTimestamp() });
          staffNameInput.value = '';
          staffEmailInput.value = '';
          staffPasswordInput.value = '';
          showAdminToast(`${email} can now sign in to the staff console.`);
          renderAdminStaffList();
        } catch (err) {
          showAdminToast(err.code === 'auth/email-already-in-use' ? 'That email already has an account.' : 'Could not register that account.');
        } finally {
          registerStaffButton.disabled = false;
        }
      });
    }

    adminConsole.addEventListener('click', async event => {
      const removeStaff = event.target.closest('[data-admin-remove-staff]');
      if (removeStaff) {
        const email = removeStaff.dataset.adminRemoveStaff;
        await deleteDoc(doc(db, 'team', email));
        showAdminToast(`${email} no longer has staff access.`);
        renderAdminStaffList();
      }
    });
  }

  adminConsole.querySelectorAll('[data-admin-signout]').forEach(button => button.addEventListener('click', async () => {
    if (auth.currentUser) await signOut(auth);
    window.location.href = 'team-login.html';
  }));

  adminConsole.addEventListener('click', event => {
    const action = event.target.closest('[data-approval-action]');
    if (action) { const card = action.closest('[data-approval]'); card.querySelector('.admin-tag').textContent = action.dataset.approvalAction === 'published' ? 'On the site' : 'Sent back'; card.querySelector('.admin-actions').innerHTML = ''; showAdminToast(action.dataset.approvalAction === 'published' ? 'Promo published.' : 'Promo sent back to staff.'); return; }
    const promoEndTab = event.target.closest('[data-promo-end]');
    if (promoEndTab) {
      const mode = promoEndTab.dataset.promoEnd;
      adminConsole.querySelectorAll('.admin-tab[data-promo-end]').forEach(tab => {
        const active = tab === promoEndTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
      adminConsole.querySelectorAll('[data-promo-show]').forEach(el => {
        el.hidden = !el.dataset.promoShow.split(',').includes(mode);
      });
      return;
    }
    const inquiryTab = event.target.closest('[data-inquiry-tab]');
    if (inquiryTab) {
      const mode = inquiryTab.dataset.inquiryTab;
      adminConsole.querySelectorAll('.admin-tab[data-inquiry-tab]').forEach(tab => {
        const active = tab === inquiryTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
      adminConsole.querySelectorAll('[data-inquiry-status]').forEach(record => {
        record.hidden = mode !== 'all' && record.dataset.inquiryStatus !== mode;
      });
      return;
    }
    const toastButton = event.target.closest('[data-admin-toast]');
    if (toastButton) showAdminToast(toastButton.dataset.adminToast);
  });
}

// Owner-only: loads the live rates into the Rates & rules inputs and wires
// Save changes to write them back to Firestore. No-ops on staffpanel.html,
// where these inputs don't exist (staff's rates page is read-only).
export function initAdminRates() {
  // Peso amounts get comma-formatted; house rules are bare numbers (max
  // guests, downpayment %) and are just read/written as plain digits.
  const priceFields = {
    guests2Weekday: document.getElementById('admin-rate-guests2-weekday'),
    guests2Weekend: document.getElementById('admin-rate-guests2-weekend'),
    guests34Weekday: document.getElementById('admin-rate-guests34-weekday'),
    guests34Weekend: document.getElementById('admin-rate-guests34-weekend'),
    poolWeekday: document.getElementById('admin-rate-pool-weekday'),
    poolWeekend: document.getElementById('admin-rate-pool-weekend'),
  };
  const numberFields = {
    maxGuests: document.getElementById('admin-rate-max-guests'),
    downpayment: document.getElementById('admin-rate-downpayment'),
  };
  const saveButton = document.getElementById('admin-rates-save');
  if (!saveButton || Object.values(priceFields).some(el => !el) || Object.values(numberFields).some(el => !el)) return;

  fetchRates().then(rates => {
    Object.entries(priceFields).forEach(([key, input]) => {
      input.value = Number(rates[key]).toLocaleString('en-US');
    });
    Object.entries(numberFields).forEach(([key, input]) => {
      input.value = rates[key];
    });
  });

  saveButton.addEventListener('click', async () => {
    const rates = {};
    Object.entries(priceFields).forEach(([key, input]) => {
      rates[key] = Number(input.value.replace(/[^\d.]/g, '')) || 0;
    });
    Object.entries(numberFields).forEach(([key, input]) => {
      rates[key] = Number(input.value.replace(/[^\d.]/g, '')) || defaultRates[key];
    });
    saveButton.disabled = true;
    try {
      await saveRates(rates);
      Object.entries(priceFields).forEach(([key, input]) => {
        input.value = rates[key].toLocaleString('en-US');
      });
      Object.entries(numberFields).forEach(([key, input]) => {
        input.value = rates[key];
      });
      showAdminToast('Rates & rules saved. Live on the booking page and staff console.');
    } catch (err) {
      showAdminToast('Could not save — check your connection and try again.');
    } finally {
      saveButton.disabled = false;
    }
  });
}

// Staff-only: keeps the read-only House rules line live — no refresh needed
// — and lights up a "!" badge on the Rates & rules nav button whenever the
// owner saves a change while this page is open elsewhere in the console.
export function initStaffRatesSync() {
  const maxGuestsEl = document.getElementById('rate-max-guests');
  const downpaymentEl = document.getElementById('rate-downpayment');
  const ratesNavButton = document.querySelector('[data-admin-go="rates"]');
  const badge = document.getElementById('rates-notify-badge');
  if (!maxGuestsEl && !downpaymentEl && !badge) return;

  if (ratesNavButton && badge) {
    ratesNavButton.addEventListener('click', () => badge.classList.remove('show'));
  }

  subscribeToRates((rates, isInitial) => {
    if (maxGuestsEl) maxGuestsEl.textContent = rates.maxGuests;
    if (downpaymentEl) downpaymentEl.textContent = rates.downpayment;
    const ratesPageOpen = document.querySelector('[data-admin-page="rates"]')?.classList.contains('active');
    if (!isInitial && !ratesPageOpen && badge) badge.classList.add('show');
  });
}

// Side-nav page switching, shared by both panels. `onCalendarOpen` (from
// initAdminCalendar()'s return value) resets the calendar to today's month
// each time its nav link is opened.
export function initAdminNav({ onCalendarOpen } = {}) {
  const adminConsole = document.getElementById('admin-console');
  const adminLinks = adminConsole.querySelectorAll('[data-admin-go]');
  const adminPages = adminConsole.querySelectorAll('[data-admin-page]');

  // Keeps the current admin page in the URL hash (#promos, #rates, ...) so a
  // refresh reopens the same page instead of always falling back to this
  // role's default landing page.
  function activatePage(page, { updateHash = true } = {}) {
    adminPages.forEach(panel => {
      const active = panel.dataset.adminPage === page;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    adminLinks.forEach(item => item.classList.toggle('active', item.dataset.adminGo === page));
    if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#${page}`);
  }

  adminLinks.forEach(link => link.addEventListener('click', () => {
    const page = link.dataset.adminGo;
    activatePage(page);
    if (page === 'calendar' && onCalendarOpen) onCalendarOpen();
  }));

  const hashPage = location.hash.slice(1);
  const validPages = new Set(Array.from(adminPages).map(p => p.dataset.adminPage));
  if (validPages.has(hashPage)) activatePage(hashPage, { updateHash: false });
}
