import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { registerForPushNotifications } from '../services/notificationService';
import { clearAllCache } from '../utils/offlineCache';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [pendingTwoFA, setPendingTwoFA] = useState(false);

  async function loadUser(firebaseUser, force = false) {
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!snap.exists()) return;
      const profile = snap.data();

      // Block unverified registrations
      if (profile.otpVerified === false && !force) {
        setUser(null);
        setUserProfile(null);
        return;
      }

      setUser(firebaseUser);
      setUserProfile(profile);
      setPendingTwoFA(false);
      if (Platform.OS !== 'web') {
        registerForPushNotifications(firebaseUser.uid).catch(console.warn);
      }
    } catch (e) {
      console.warn('Could not load user profile:', e.message);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap    = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profile = snap.exists() ? snap.data() : null;

        // If 2FA is enabled, hold — OTP screen will call recheckAuthAfter2FA
        if (profile?.twoFactorEnabled && !pendingTwoFA) {
          setLoading(false);
          return;
        }

        await loadUser(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
        setPendingTwoFA(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const recheckAuth = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) await loadUser(currentUser);
    else { setUser(null); setUserProfile(null); }
  };

  const recheckAuthAfter2FA = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) await loadUser(currentUser, true);
    else { setUser(null); setUserProfile(null); }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setUserProfile(snap.data());
    } catch (e) {
      console.warn('refreshProfile error:', e.message);
    }
  };

  const logout = async () => {
    await clearAllCache();
    await signOut(auth);
  };

  const isAdmin = userProfile?.isAdmin === true;

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, logout, refreshProfile, recheckAuth, recheckAuthAfter2FA, isAdmin }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}
