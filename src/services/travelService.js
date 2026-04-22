import {
  collection, addDoc, getDocs, getDoc, updateDoc,
  deleteDoc, doc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─────────────────────────────────────────────
// 1. GET ALL PLANS FOR USER
// ─────────────────────────────────────────────
export async function getTravelPlans(userId) {
  const q = query(
    collection(db, 'travelPlans'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// 2. GET SINGLE PLAN
// ─────────────────────────────────────────────
export async function getTravelPlan(planId) {
  const snap = await getDoc(doc(db, 'travelPlans', planId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ─────────────────────────────────────────────
// 3. CREATE PLAN
// ─────────────────────────────────────────────
export async function createTravelPlan(userId, { title, description = '' }) {
  const ref = await addDoc(collection(db, 'travelPlans'), {
    userId,
    title,
    description,
    days:      [{ id: '1', label: 'Day 1', stops: [] }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─────────────────────────────────────────────
// 4. UPDATE PLAN (save days + stops)
// ─────────────────────────────────────────────
export async function updateTravelPlan(planId, data) {
  await updateDoc(doc(db, 'travelPlans', planId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// 5. DELETE PLAN
// ─────────────────────────────────────────────
export async function deleteTravelPlan(planId) {
  await deleteDoc(doc(db, 'travelPlans', planId));
}

// ─────────────────────────────────────────────
// 6. ADD STOP TO A DAY
// ─────────────────────────────────────────────
export async function addStopToPlan(planId, dayId, stop) {
  const plan = await getTravelPlan(planId);
  if (!plan) throw new Error('Plan not found');
  const updatedDays = plan.days.map(day => {
    if (day.id !== dayId) return day;
    const alreadyExists = (day.stops ?? []).some(s => s.id === stop.id);
    if (alreadyExists) return day;
    return { ...day, stops: [...(day.stops ?? []), stop] };
  });
  await updateTravelPlan(planId, { days: updatedDays });
}

// ─────────────────────────────────────────────
// 7. OPTIMIZE ROUTE (sort stops by proximity)
// ─────────────────────────────────────────────
export function optimizeRoute(stops) {
  // Sort stops that have location by proximity
  // using nearest neighbor algorithm
  if (stops.length <= 1) return stops;

  const withLocation    = stops.filter(s => s.location);
  const withoutLocation = stops.filter(s => !s.location);

  if (withLocation.length <= 1) return stops;

  const optimized = [withLocation[0]];
  const remaining = withLocation.slice(1);

  while (remaining.length > 0) {
    const last = optimized[optimized.length - 1];
    let nearestIndex = 0;
    let nearestDist  = Infinity;

    remaining.forEach((stop, i) => {
      const dist = Math.sqrt(
        Math.pow(stop.location.latitude  - last.location.latitude,  2) +
        Math.pow(stop.location.longitude - last.location.longitude, 2)
      );
      if (dist < nearestDist) {
        nearestDist  = dist;
        nearestIndex = i;
      }
    });

    optimized.push(remaining[nearestIndex]);
    remaining.splice(nearestIndex, 1);
  }

  return [...optimized, ...withoutLocation];
}
