import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyB5T-Yl4kzZ0YtRTOBBKFgjDLPSbGeIeYw",
  authDomain:        "cuoiky-b24bb.firebaseapp.com",
  projectId:         "cuoiky-b24bb",
  storageBucket:     "cuoiky-b24bb.firebasestorage.app",
  messagingSenderId: "601652648520",
  appId:             "1:601652648520:web:dbb22d82721932f9cd567d",
  measurementId:     "G-KPWBBPY9PT"
};

const app = initializeApp(firebaseConfig);

// ── Auth ──────────────────────────────────────────────────
let auth;
if (Platform.OS === 'web') {
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
} else {
  const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// ── Firestore ─────────────────────────────────────────────
let db;
if (Platform.OS === 'web') {
  // Web only: persistent cache with multi-tab support
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e) {
    db = getFirestore(app);
    console.warn('Web persistence not available:', e.message);
  }
} else {
  // Mobile: standard Firestore (AsyncStorage handles offline via auth persistence)
  db = getFirestore(app);
}

export { auth, db };
export const storage = getStorage(app);
export default app;
