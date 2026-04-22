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
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebase';

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
  try {
    // Upload to Cloudinary instead of Firebase Storage
    const formData = new FormData();

    if (uri.startsWith('data:')) {
      // Already base64
      formData.append('file', uri);
    } else {
      // Fetch and convert to blob for web, use uri directly for mobile
      const { Platform } = require('react-native');
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob     = await response.blob();
        formData.append('file', blob);
      } else {
        // React Native — append as file object
        formData.append('file', {
          uri,
          type: 'image/jpeg',
          name: `profile_${userId}.jpg`,
        });
      }
    }

    formData.append('upload_preset', 'exploreease_reviews');
    formData.append('folder', 'profilePics');

    const res  = await fetch(
      'https://api.cloudinary.com/v1_1/dpmtwyqg6/image/upload',
      { method: 'POST', body: formData }
    );
    const data = await res.json();

    if (!data.secure_url) {
      throw new Error('Cloudinary upload failed');
    }

    const url = data.secure_url;

    await updateDoc(doc(db, 'users', userId), { profilePicUrl: url });
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { photoURL: url });
    }
    return url;
  } catch (e) {
    console.error('uploadProfilePicture error:', e);
    throw e;
  }
}

export async function addBookmark(userId, itemId, itemType, itemData = {}) {
  await setDoc(doc(db, 'bookmarks', `${userId}_${itemId}`), {
    userId,
    itemId,
    itemType,
    name:     itemData.name     ?? itemData.title   ?? '',
    address:  itemData.address  ?? '',
    imageUrl: itemData.images?.[0] ?? itemData.imageUrl ?? '',
    createdAt: serverTimestamp(),
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
