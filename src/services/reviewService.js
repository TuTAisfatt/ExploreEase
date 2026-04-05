import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy, limit, startAfter,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const PAGE_SIZE = 10;

export async function getReviews({ targetId, sortBy = 'newest', lastDoc } = {}) {
  const orderField = sortBy === 'top-rated' ? 'rating' : 'createdAt';
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
    rating, text, photoUrl: photoUrl ?? null,
    helpful: [], flagged: false,
    createdAt: serverTimestamp(),
  });
  const targetCol = targetType === 'attraction' ? 'attractions' : 'events';
  await updateDoc(doc(db, targetCol, targetId), {
    ratingSum:   increment(rating),
    reviewCount: increment(1),
  });
}

export async function flagReview(reviewId) {
  await updateDoc(doc(db, 'reviews', reviewId), { flagged: true });
}

export async function deleteReview(reviewId) {
  await deleteDoc(doc(db, 'reviews', reviewId));
}

export async function replyToReview(reviewId, reply, replierName) {
  await updateDoc(doc(db, 'reviews', reviewId), {
    reply, replierName, repliedAt: serverTimestamp(),
  });
}
