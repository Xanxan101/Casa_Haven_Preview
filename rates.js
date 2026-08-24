// Casa Haven — shared rates data layer. One Firestore doc
// ("settings/rates") holding the nightly + pool-access numbers and house
// rules, edited from the owner console and read by the public Booking page
// and the staff console's read-only reference view, so all three stay in sync.
import { db } from './firebase.js';
import { doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const RATES_DOC = ['settings', 'rates'];

export const defaultRates = {
  guests2Weekday: 1900, guests2Weekend: 2000,
  guests34Weekday: 2400, guests34Weekend: 2500,
  poolWeekday: 150, poolWeekend: 300,
  maxGuests: 4, downpayment: 50,
};

// Falls back to the defaults above (the same numbers already on the page)
// if Firestore is unreachable or the doc hasn't been saved yet.
export async function fetchRates() {
  try {
    const snap = await getDoc(doc(db, ...RATES_DOC));
    return snap.exists() ? { ...defaultRates, ...snap.data() } : defaultRates;
  } catch (err) {
    return defaultRates;
  }
}

export async function saveRates(rates) {
  await setDoc(doc(db, ...RATES_DOC), rates);
}

// Live updates (no refresh needed) — calls back immediately with the current
// rates, then again every time they change elsewhere (e.g. the owner saving
// from their own console). `isInitial` is true only for that first call, so
// callers can tell "here's what it already was" apart from "it just changed".
// Returns an unsubscribe function.
export function subscribeToRates(callback) {
  let isInitial = true;
  return onSnapshot(doc(db, ...RATES_DOC), snap => {
    const rates = snap.exists() ? { ...defaultRates, ...snap.data() } : defaultRates;
    callback(rates, isInitial);
    isInitial = false;
  }, () => {
    // Unreachable/permission error — treat as "nothing changed" rather than
    // leaving the caller hanging.
    callback(defaultRates, isInitial);
    isInitial = false;
  });
}

export const formatPeso = amount => `₱${Number(amount).toLocaleString('en-US')}`;
