import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy, limit, startAfter,
  serverTimestamp, increment, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PAGE_SIZE = 10;

export async function getReviews({ targetId, sortBy = 'newest', lastDoc } = {}) {
  const orderField =
    sortBy === 'top-rated'    ? 'rating'    :
    sortBy === 'most-helpful' ? 'helpful'   :
    'createdAt';
  let q = query(
    collection(db, 'reviews'),
    where('targetId', '==', targetId),
    orderBy(orderField, 'desc'),
    limit(PAGE_SIZE)
  );
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    items:   snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}

export async function addReview({ targetId, targetType, userId, userName, rating, text, photoUrl }) {
  await addDoc(collection(db, 'reviews'), {
    targetId, targetType, userId, userName,
    rating, text,
    photoUrl:  photoUrl ?? null,
    helpful:   0,        // ← number
    helpfulBy: [],       // ← array of userIds
    flagged:   false,
    createdAt: serverTimestamp(),
  });
  const targetCol = targetType === 'attraction' ? 'attractions' : 'events';
  await updateDoc(doc(db, targetCol, targetId), {
    ratingSum:   increment(rating),
    reviewCount: increment(1),
  });
}

export async function markHelpful(reviewId, userId) {
  await updateDoc(doc(db, 'reviews', reviewId), {
    helpful:   increment(1),       // ← increment number
    helpfulBy: arrayUnion(userId), // ← add to array
  });
}

export async function unmarkHelpful(reviewId, userId) {
  await updateDoc(doc(db, 'reviews', reviewId), {
    helpful:   increment(-1),       // ← decrement number
    helpfulBy: arrayRemove(userId), // ← remove from array
  });
}

export async function flagReview(reviewId) {
  await updateDoc(doc(db, 'reviews', reviewId), { flagged: true });
}

export async function deleteReview(reviewId, targetId, targetType, rating) {
  await deleteDoc(doc(db, 'reviews', reviewId));
  if (targetId && targetType && rating) {
    const targetCol = targetType === 'attraction' ? 'attractions' : 'events';
    await updateDoc(doc(db, targetCol, targetId), {
      ratingSum:   increment(-rating),
      reviewCount: increment(-1),
    });
  }
}

export async function replyToReview(reviewId, reply, replierName) {
  await updateDoc(doc(db, 'reviews', reviewId), {
    reply, replierName, repliedAt: serverTimestamp(),
  });
}

export async function getFlaggedReviews() {
  const q    = query(collection(db, 'reviews'), where('flagged', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveFlaggedReview(reviewId) {
  await updateDoc(doc(db, 'reviews', reviewId), { flagged: false });
}