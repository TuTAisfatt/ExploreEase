import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { notifyWelcome } from './notificationService';

// ─────────────────────────────────────────────
// 1. REGISTER WITH EMAIL & PASSWORD
// ─────────────────────────────────────────────
export async function registerWithEmail(name, email, password) {
  try {
    // Step 1 — Create Firebase Auth account
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Step 2 — Set display name
    try {
      await updateProfile(user, { displayName: name });
    } catch (e) {
      console.warn('updateProfile failed:', e.message);
    }

    // Step 3 — Send email verification (non-critical)
    try {
      await sendEmailVerification(user);
    } catch (e) {
      console.warn('sendEmailVerification failed:', e.message);
    }

    // Step 4 — Create Firestore document
    await createUserDocument(user.uid, {
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      profilePicUrl: '',
      age:           null,
      gender:        null,
      travelStyle:   'solo',
      interests:     [],
      isAdmin:       false,
      otpVerified:   false,
      createdAt:     serverTimestamp(),
    });

    // Step 5 — Welcome notification (non-critical)
    try {
      await notifyWelcome(user.uid);
    } catch (e) {
      console.warn('Welcome notification failed:', e.message);
    }

    return user;

  } catch (e) {
    console.error('registerWithEmail error:', e.code, e.message);
    throw e;
  }
}

// ─────────────────────────────────────────────
// 2. LOGIN WITH EMAIL & PASSWORD
// ─────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

// ─────────────────────────────────────────────
// 3. GOOGLE SIGN-IN
// ─────────────────────────────────────────────
export async function loginWithGoogle(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  const { user }   = await signInWithCredential(auth, credential);

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) {
    await createUserDocument(user.uid, {
      name:          user.displayName ?? '',
      email:         user.email ?? '',
      profilePicUrl: user.photoURL ?? '',
      age:           null,
      gender:        null,
      travelStyle:   'solo',
      interests:     [],
      isAdmin:       false,
      otpVerified:   true, // Google accounts skip OTP
      createdAt:     serverTimestamp(),
    });

    try {
      await notifyWelcome(user.uid);
    } catch (e) {
      console.warn('Welcome notification failed:', e.message);
    }
  }

  return user;
}

// ─────────────────────────────────────────────
// 4. FORGOT PASSWORD
// ─────────────────────────────────────────────
export async function forgotPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─────────────────────────────────────────────
// 5. RESEND VERIFICATION EMAIL
// ─────────────────────────────────────────────
export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    await sendEmailVerification(user);
  }
}

// ─────────────────────────────────────────────
// 6. DELETE ACCOUNT (GDPR: right to erasure)
// ─────────────────────────────────────────────
export async function deleteAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is logged in.');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}

// ─────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────
async function createUserDocument(uid, data) {
  await setDoc(doc(db, 'users', uid), data);
}

// ─────────────────────────────────────────────
// FRIENDLY ERROR MESSAGES
// ─────────────────────────────────────────────
export function getFriendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/user-disabled':          'This account has been disabled.',
    'auth/requires-recent-login':  'Please log in again to continue.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}