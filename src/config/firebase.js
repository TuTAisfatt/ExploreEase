import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

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

// Auth — different setup for web vs mobile
let auth;
if (Platform.OS === 'web') {
  // Web uses standard getAuth — no AsyncStorage needed
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
} else {
  // Mobile uses initializeAuth with AsyncStorage for session persistence
  const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;