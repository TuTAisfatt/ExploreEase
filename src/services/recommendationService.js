import { collection, getDocs, doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getDistance } from './locationService';

// ─────────────────────────────────────────────
// 1. TRACK USER ACTIVITY
// Call this whenever user views/bookmarks an attraction
// ─────────────────────────────────────────────
export async function trackActivity(userId, attractionId, action) {
  // action: 'view' | 'bookmark' | 'review' | 'directions'
  const ref = doc(db, 'userActivity', `${userId}_${attractionId}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, {
      [action]: increment(1),
      lastSeen: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      userId,
      attractionId,
      view:       action === 'view'      ? 1 : 0,
      bookmark:   action === 'bookmark'  ? 1 : 0,
      review:     action === 'review'    ? 1 : 0,
      directions: action === 'directions'? 1 : 0,
      lastSeen:   serverTimestamp(),
    });
  }
}

// ─────────────────────────────────────────────
// 2. GET PERSONALIZED RECOMMENDATIONS
// Scores attractions based on:
//   - User interests match (+40 points)
//   - Travel style match (+20 points)
//   - High rating (+15 points)
//   - Close proximity (+10 points)
//   - Time of day context (+10 points)
//   - Previously viewed (-5 points — show new things)
// ─────────────────────────────────────────────
export async function getRecommendations({
  userProfile,
  userLat,
  userLng,
  allAttractions,
  limit = 10,
}) {
  const interests   = userProfile?.interests   ?? [];
  const travelStyle = userProfile?.travelStyle ?? 'solo';

  // Get user's activity history
  let viewedIds = new Set();
  try {
    const activitySnap = await getDocs(collection(db, 'userActivity'));
    activitySnap.docs
      .filter(d => d.data().userId === userProfile?.uid)
      .forEach(d => viewedIds.add(d.data().attractionId));
  } catch (e) {
    // Activity tracking not critical — continue without it
  }

  const timeContext = getTimeContext();

  const scored = allAttractions.map(attraction => {
    let score = 0;

    // ── Interest match ─────────────────────────────
    if (interests.includes(attraction.category)) score += 40;

    // ── Travel style context ───────────────────────
    if (travelStyle === 'family' && ['food', 'nature', 'culture'].includes(attraction.category)) score += 20;
    if (travelStyle === 'solo'   && ['adventure', 'culture'].includes(attraction.category))      score += 20;
    if (travelStyle === 'couple' && ['food', 'nature'].includes(attraction.category))            score += 20;
    if (travelStyle === 'group'  && ['food', 'shopping', 'adventure'].includes(attraction.category)) score += 20;

    // ── Rating score ───────────────────────────────
    if (attraction.reviewCount > 0) {
      const avg = attraction.ratingSum / attraction.reviewCount;
      score += avg * 3; // up to 15 points for 5-star
    }

    // ── Proximity score ────────────────────────────
    if (userLat && userLng && attraction.location) {
      const lat = attraction.location.latitude  ?? attraction.location._lat;
      const lng = attraction.location.longitude ?? attraction.location._long;
      const dist = getDistance(userLat, userLng, lat, lng);
      if (dist < 2)  score += 10;
      else if (dist < 5)  score += 7;
      else if (dist < 10) score += 4;
    }

    // ── Time of day context ────────────────────────
    if (timeContext === 'morning'   && ['culture', 'nature'].includes(attraction.category))    score += 10;
    if (timeContext === 'afternoon' && ['shopping', 'food'].includes(attraction.category))     score += 10;
    if (timeContext === 'evening'   && ['food', 'adventure'].includes(attraction.category))    score += 10;
    if (timeContext === 'night'     && ['food'].includes(attraction.category))                 score += 10;

    // ── Seen before — slight penalty ──────────────
    if (viewedIds.has(attraction.id)) score -= 5;

    return { ...attraction, score };
  });

  // Sort by score descending
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─────────────────────────────────────────────
// 3. GET SIMILAR ATTRACTIONS ("You might also like")
// Finds attractions similar to a given one based on:
//   - Same category
//   - Similar tags
//   - Nearby location
// ─────────────────────────────────────────────
export async function getSimilarAttractions(attraction, allAttractions, limit = 4) {
  const targetLat = attraction.location?.latitude  ?? attraction.location?._lat;
  const targetLng = attraction.location?.longitude ?? attraction.location?._long;

  return allAttractions
    .filter(a => a.id !== attraction.id) // exclude self
    .map(a => {
      let score = 0;

      // Same category = strong match
      if (a.category === attraction.category) score += 50;

      // Shared tags
      const sharedTags = (a.tags ?? []).filter(t => (attraction.tags ?? []).includes(t));
      score += sharedTags.length * 10;

      // Similar price level
      if (a.priceLevel === attraction.priceLevel) score += 10;

      // Proximity to original attraction
      if (targetLat && targetLng && a.location) {
        const lat  = a.location.latitude  ?? a.location._lat;
        const lng  = a.location.longitude ?? a.location._long;
        const dist = getDistance(targetLat, targetLng, lat, lng);
        if (dist < 3) score += 20;
        else if (dist < 7) score += 10;
      }

      return { ...a, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─────────────────────────────────────────────
// 4. GET TIME CONTEXT
// ─────────────────────────────────────────────
function getTimeContext() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

// ─────────────────────────────────────────────
// 5. GET WEATHER CONTEXT (simplified)
// In a real app you'd call a weather API
// For now we use seasonal context based on month
// ─────────────────────────────────────────────
export function getSeasonalContext() {
  const month = new Date().getMonth(); // 0-11
  // Vietnam: dry season Nov-Apr, wet season May-Oct
  if (month >= 10 || month <= 3) {
    return {
      season:      'dry',
      label:       'Dry season',
      suggestion:  'Great time for outdoor activities!',
      boostCategories: ['nature', 'adventure'],
    };
  }
  return {
    season:      'wet',
    label:       'Wet season',
    suggestion:  'Consider indoor activities today.',
    boostCategories: ['culture', 'shopping', 'food'],
  };
}