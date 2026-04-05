import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, db, storage } from '../config/firebase';

const COLLECTION = 'users';

export const createUser = async (uid, data) => {
  await setDoc(doc(db, COLLECTION, uid), data);
};

export const getUserById = async (uid) => {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUser = async (uid, data) => {
  await updateDoc(doc(db, COLLECTION, uid), data);
};

export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export async function updateUserProfile(userId, data) {
  await updateDoc(doc(db, 'users', userId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  if (data.name && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: data.name });
  }
}

export async function uploadProfilePicture(userId, uri) {
  const response  = await fetch(uri);
  const blob      = await response.blob();
  const storageRef = ref(storage, `profilePics/${userId}.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', userId), { profilePicUrl: url });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: url });
  }
  return url;
}

export async function addBookmark(userId, itemId, itemType) {
  await setDoc(doc(db, 'bookmarks', `${userId}_${itemId}`), {
    userId, itemId, itemType, createdAt: serverTimestamp(),
  });
}

export async function removeBookmark(userId, itemId) {
  await deleteDoc(doc(db, 'bookmarks', `${userId}_${itemId}`));
}

export async function getBookmarks(userId) {
  const q = query(
    collection(db, 'bookmarks'),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
