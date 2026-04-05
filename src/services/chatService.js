import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'messages';

export const sendMessage = async (data) => {
  await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToMessages = (callback, pageLimit = 50) => {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'asc'),
    limit(pageLimit)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
};
