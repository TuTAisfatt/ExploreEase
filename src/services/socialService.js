import {
  collection, addDoc, getDocs, getDoc, deleteDoc,
  doc, query, where, orderBy, limit, serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─────────────────────────────────────────────
// 1. FOLLOW A USER
// ─────────────────────────────────────────────
export async function followUser(followerId, followingId) {
  const followId = `${followerId}_${followingId}`;
  await addDoc(collection(db, 'follows'), {
    id:          followId,
    followerId,
    followingId,
    createdAt:   serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// 2. UNFOLLOW A USER
// ─────────────────────────────────────────────
export async function unfollowUser(followerId, followingId) {
  const q    = query(
    collection(db, 'follows'),
    where('followerId',  '==', followerId),
    where('followingId', '==', followingId)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ─────────────────────────────────────────────
// 3. CHECK IF FOLLOWING
// ─────────────────────────────────────────────
export async function isFollowing(followerId, followingId) {
  const q    = query(
    collection(db, 'follows'),
    where('followerId',  '==', followerId),
    where('followingId', '==', followingId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─────────────────────────────────────────────
// 4. GET FOLLOWERS
// ─────────────────────────────────────────────
export async function getFollowers(userId) {
  const q    = query(collection(db, 'follows'), where('followingId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().followerId);
}

// ─────────────────────────────────────────────
// 5. GET FOLLOWING
// ─────────────────────────────────────────────
export async function getFollowing(userId) {
  const q    = query(collection(db, 'follows'), where('followerId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().followingId);
}

// ─────────────────────────────────────────────
// 6. GET ALL USERS (for search)
// ─────────────────────────────────────────────
export async function searchUsers(keyword) {
  const snap = await getDocs(collection(db, 'users'));
  const kw   = keyword.toLowerCase();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u =>
      u.name?.toLowerCase().includes(kw) ||
      u.email?.toLowerCase().includes(kw)
    );
}

// ─────────────────────────────────────────────
// 7. POST ACTIVITY
// ─────────────────────────────────────────────
export async function postActivity(userId, userName, { type, targetName, targetId }) {
  await addDoc(collection(db, 'activities'), {
    userId,
    userName,
    type,       // 'rated' | 'joined' | 'bookmarked' | 'reviewed'
    targetName,
    targetId,
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// 8. GET ACTIVITY FEED (from followed users)
// ─────────────────────────────────────────────
export async function getActivityFeed(followingIds) {
  if (!followingIds || followingIds.length === 0) return [];
  // Firestore 'in' query supports max 10 values
  const chunks = [];
  for (let i = 0; i < followingIds.length; i += 10) {
    chunks.push(followingIds.slice(i, i + 10));
  }
  const results = await Promise.all(
    chunks.map(chunk => {
      const q = query(
        collection(db, 'activities'),
        where('userId', 'in', chunk),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      return getDocs(q).then(snap =>
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    })
  );
  return results
    .flat()
    .sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? 0;
      const bMs = b.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    })
    .slice(0, 30);
}

// ─────────────────────────────────────────────
// 9. GET RECENT GLOBAL ACTIVITY (for new users)
// ─────────────────────────────────────────────
export async function getGlobalActivity() {
  const q    = query(
    collection(db, 'activities'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getFollowerCount(userId) {
  const snap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', userId)));
  return snap.size;
}

export async function getFollowingCount(userId) {
  const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', userId)));
  return snap.size;
}

export async function getFollowerProfiles(userId) {
  const snap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', userId)));
  const profiles = await Promise.all(
    snap.docs.map(async d => {
      const s = await getDoc(doc(db, 'users', d.data().followerId));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    })
  );
  return profiles.filter(Boolean);
}

export async function getFollowingProfiles(userId) {
  const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', userId)));
  const profiles = await Promise.all(
    snap.docs.map(async d => {
      const s = await getDoc(doc(db, 'users', d.data().followingId));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    })
  );
  return profiles.filter(Boolean);
}
