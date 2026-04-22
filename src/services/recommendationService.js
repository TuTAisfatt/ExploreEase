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
// 3. GET SIMILAR ATTRACTIONS (Enhanced AI similarity)
// Uses vector-style scoring across multiple dimensions:
//   - Category match (semantic similarity)
//   - Tag overlap (cosine-style similarity)
//   - Price level proximity
//   - Rating similarity
//   - Geographic proximity
//   - Description keyword overlap
// ─────────────────────────────────────────────
export async function getSimilarAttractions(attraction, allAttractions, limit = 4) {
  const targetLat = attraction.location?.latitude  ?? attraction.location?._lat;
  const targetLng = attraction.location?.longitude ?? attraction.location?._long;

  // ── Category semantic groups ──────────────────────────────
  // Places in the same group are "semantically similar"
  const categoryGroups = {
    culture:   ['culture', 'history', 'art'],
    food:      ['food', 'restaurant', 'cafe'],
    nature:    ['nature', 'park', 'outdoor'],
    adventure: ['adventure', 'sport', 'activity'],
    shopping:  ['shopping', 'market', 'mall'],
  };

  function getCategoryGroup(category) {
    for (const [group, members] of Object.entries(categoryGroups)) {
      if (members.includes(category)) return group;
    }
    return category;
  }

  // ── Tag vector similarity (cosine-style) ──────────────────
  function tagSimilarity(tagsA, tagsB) {
    if (!tagsA?.length || !tagsB?.length) return 0;
    const setA          = new Set(tagsA.map(t => t.toLowerCase()));
    const setB          = new Set(tagsB.map(t => t.toLowerCase()));
    const intersection  = [...setA].filter(t => setB.has(t)).length;
    const union         = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0; // Jaccard similarity
  }

  // ── Description keyword overlap ───────────────────────────
  function descriptionSimilarity(descA, descB) {
    if (!descA || !descB) return 0;
    const wordsA       = new Set(descA.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB       = new Set(descB.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union        = new Set([...wordsA, ...wordsB]).size;
    return union > 0 ? intersection / union : 0;
  }

  return allAttractions
    .filter(a => a.id !== attraction.id)
    .map(a => {
      let score = 0;

      // ── 1. Category semantic similarity (0-50 pts) ─────────
      if (a.category === attraction.category) {
        score += 50; // exact match
      } else if (getCategoryGroup(a.category) === getCategoryGroup(attraction.category)) {
        score += 25; // same semantic group
      }

      // ── 2. Tag vector similarity (0-30 pts) ────────────────
      const tagSim = tagSimilarity(a.tags, attraction.tags);
      score += tagSim * 30;

      // ── 3. Description keyword overlap (0-15 pts) ──────────
      const descSim = descriptionSimilarity(a.description, attraction.description);
      score += descSim * 15;

      // ── 4. Price level proximity (0-10 pts) ────────────────
      if (a.priceLevel !== undefined && attraction.priceLevel !== undefined) {
        const priceDiff = Math.abs(a.priceLevel - attraction.priceLevel);
        score += Math.max(0, 10 - priceDiff * 5);
      }

      // ── 5. Rating similarity (0-10 pts) ────────────────────
      const ratingA    = attraction.reviewCount ? attraction.ratingSum / attraction.reviewCount : 0;
      const ratingB    = a.reviewCount ? a.ratingSum / a.reviewCount : 0;
      const ratingDiff = Math.abs(ratingA - ratingB);
      score += Math.max(0, 10 - ratingDiff * 2);

      // ── 6. Geographic proximity (0-20 pts) ─────────────────
      if (targetLat && targetLng && a.location) {
        const lat  = a.location.latitude  ?? a.location._lat;
        const lng  = a.location.longitude ?? a.location._long;
        const dist = getDistance(targetLat, targetLng, lat, lng);
        if (dist < 1)       score += 20;
        else if (dist < 3)  score += 15;
        else if (dist < 7)  score += 10;
        else if (dist < 15) score += 5;
      }

      return { ...a, similarityScore: Math.round(score) };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
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

// ─────────────────────────────────────────────
// 6. SUGGEST ONE-DAY ITINERARY
// Given available hours and time of day,
// suggest a sequence of attractions
// ─────────────────────────────────────────────
export function suggestDayItinerary({
  attractions,
  availableHours = 4,
  timeOfDay = 'afternoon',
  mood = 'explore',
  maxDistance = 10,
  userLat,
  userLng,
  userInterests = [],
}) {
  const moodCategories = {
    explore:  ['culture', 'nature', 'adventure'],
    relax:    ['nature', 'food'],
    foodie:   ['food'],
    shop:     ['shopping', 'food'],
    culture:  ['culture', 'history'],
    active:   ['adventure', 'nature', 'sport'],
  };

  const categoryDuration = {
    culture:   1.5,
    food:      1.0,
    shopping:  1.5,
    nature:    2.0,
    adventure: 2.0,
    default:   1.0,
  };

  const timeBoosts = {
    morning:   ['culture', 'nature'],
    afternoon: ['shopping', 'food'],
    evening:   ['food', 'adventure'],
    night:     ['food'],
  };

  const preferredCategories = moodCategories[mood] ?? moodCategories.explore;
  const boostedCategories   = timeBoosts[timeOfDay] ?? [];

  // Filter by distance and approved status
  let candidates = attractions.filter(a => {
    if (a.approved === false) return false;
    if (userLat && userLng && a.location) {
      const lat  = a.location.latitude  ?? a.location._lat;
      const lng  = a.location.longitude ?? a.location._long;
      const dist = getDistance(userLat, userLng, lat, lng);
      return dist <= maxDistance;
    }
    return true;
  });

  // Score candidates
  candidates = candidates.map(a => {
    let score = 0;
    const isMoodMatch = preferredCategories.includes(a.category);

    if (isMoodMatch)                              score += 100;
    if (boostedCategories.includes(a.category))   score += 20;
    if (userInterests.includes(a.category))       score += 30;
    if (a.reviewCount > 0)
      score += (a.ratingSum / a.reviewCount) * 5;

    return { ...a, score, isMoodMatch };
  });

  // Mood matches always come first
  candidates.sort((a, b) => {
    if (a.isMoodMatch && !b.isMoodMatch) return -1;
    if (!a.isMoodMatch && b.isMoodMatch) return 1;
    return b.score - a.score;
  });

  const moodMatches = candidates.filter(a => a.isMoodMatch);
  const fallbacks   = candidates.filter(a => !a.isMoodMatch);

  // Fill itinerary from mood matches first, fallback only if needed
  const itinerary = [];
  let hoursUsed   = 0;

  for (const pool of [moodMatches, fallbacks]) {
    for (const attraction of pool) {
      const duration = categoryDuration[attraction.category] ?? categoryDuration.default;
      if (hoursUsed + duration <= availableHours) {
        itinerary.push({ ...attraction, estimatedDuration: duration });
        hoursUsed += duration;
      }
      if (hoursUsed >= availableHours) break;
    }
    if (hoursUsed >= availableHours) break;
  }

  return { itinerary, totalHours: hoursUsed };
}