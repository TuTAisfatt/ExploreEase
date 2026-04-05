import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'attractions';

export const createAttraction = async (data) => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    rating: 0,
    reviewCount: 0,
  });
  return ref.id;
};

export const getAttractions = async (cursor = null, pageLimit = 10, category = null) => {
  let q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(pageLimit)
  );
  if (category && category !== 'all') {
    q = query(q, where('category', '==', category));
  }
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const last = snap.docs[snap.docs.length - 1] || null;
  return { items, last };
};

export const getAttractionById = async (id) => {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const searchAttractions = async (keyword) => {
  const snap = await getDocs(collection(db, COLLECTION));
  const kw = keyword.toLowerCase();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.name?.toLowerCase().includes(kw) || a.address?.toLowerCase().includes(kw));
};

export const updateAttraction = async (id, data) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteAttraction = async (id) => {
  await deleteDoc(doc(db, COLLECTION, id));
};
