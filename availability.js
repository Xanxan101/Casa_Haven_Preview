// Casa Haven — shared availability data layer. One Firestore doc per date
// ("availability/YYYY-MM-DD") with a `status` field ('booked' | 'closed');
// a date with no doc is open. Read by both the admin calendar (owner/staff
// panels) and the public booking page's calendar so the two stay in sync.
import { db } from './firebase.js';
import {
  doc, getDocs, setDoc, deleteDoc, collection,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// { 'YYYY-MM-DD': 'booked' | 'closed' } — missing keys are open. Fails soft
// to an empty map (calendar just shows everything open) rather than
// breaking the page if Firestore is unreachable.
export async function fetchAvailabilityMap() {
  try {
    const snap = await getDocs(collection(db, 'availability'));
    const map = {};
    snap.forEach(docSnap => { map[docSnap.id] = docSnap.data().status; });
    return map;
  } catch (err) {
    return {};
  }
}

export async function setAvailabilityStatus(dateKeys, status) {
  await Promise.all(dateKeys.map(key => (
    status === 'open'
      ? deleteDoc(doc(db, 'availability', key))
      : setDoc(doc(db, 'availability', key), { status })
  )));
}
