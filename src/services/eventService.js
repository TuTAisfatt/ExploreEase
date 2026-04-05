import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'events';

export const createEvent = async (data) => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    attendees: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getEvents = async (cursor = null, pageLimit = 10) => {
  let q = query(collection(db, COLLECTION), orderBy('date', 'asc'), limit(pageLimit));
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const last = snap.docs[snap.docs.length - 1] || null;
  return { items, last };
};

export const getEventById = async (id) => {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateEvent = async (id, data) => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteEvent = async (id) => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const joinEvent = async (eventId, userId) => {
  await updateDoc(doc(db, COLLECTION, eventId), { attendees: arrayUnion(userId) });
};

export const leaveEvent = async (eventId, userId) => {
  await updateDoc(doc(db, COLLECTION, eventId), { attendees: arrayRemove(userId) });
};
