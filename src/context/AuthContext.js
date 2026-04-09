import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { registerForPushNotifications } from '../services/notificationService';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

  async function loadUser(firebaseUser) {
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const profile = snap.data();
        if (profile.otpVerified === true) {
          setUser(firebaseUser);
          setUserProfile(profile);
          // Register for push notifications
          registerForPushNotifications(firebaseUser.uid).catch(console.warn);
        } else {
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
        }
      }
    } catch (e) {
      console.warn('Could not load user profile:', e.message);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadUser(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Call this after OTP verification to re-check without waiting
  // for onAuthStateChanged to fire again
  const recheckAuth = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await loadUser(currentUser);
    } else {
      // No user logged in — clear state
      setUser(null);
      setUserProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setUserProfile(snap.data());
    } catch (e) {
      console.warn('Could not refresh profile:', e.message);
    }
  };

  const logout = () => signOut(auth);
  const isAdmin = userProfile?.isAdmin === true;

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, logout, refreshProfile, recheckAuth, isAdmin }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}