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

// ─────────────────────────────────────────────
// 1. REGISTER WITH EMAIL & PASSWORD
// ─────────────────────────────────────────────
export async function registerWithEmail(name, email, password) {
  // Create the Firebase Auth account
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  // Set the display name in Firebase Auth
  await updateProfile(user, { displayName: name });

  // Send email verification — user must verify before sensitive actions
  await sendEmailVerification(user);

  // Create the user's document in Firestore
  await createUserDocument(user.uid, {
    name:         name.trim(),
    email:        email.trim().toLowerCase(),
    profilePicUrl: '',
    age:          null,
    gender:       null,
    travelStyle:  'solo',
    interests:    [],
    isAdmin:      false,
    createdAt:    serverTimestamp(),
  });

  return user;
}

// ─────────────────────────────────────────────
// 2. LOGIN WITH EMAIL & PASSWORD
// ─────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

// ─────────────────────────────────────────────
// 3. GOOGLE SIGN-IN
// ─────────────────────────────────────────────
export async function loginWithGoogle(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  const { user }   = await signInWithCredential(auth, credential);

  // Only create the Firestore doc if this is a brand new user
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
      createdAt:     serverTimestamp(),
    });
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
// 6. DELETE ACCOUNT  (GDPR: right to erasure)
// ─────────────────────────────────────────────
// Requires the user to re-enter their password first (Firebase security rule)
export async function deleteAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is logged in.');

  // Re-authenticate before destructive action
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  // Delete Firestore document first, then the Auth account
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
// Map Firebase error codes → readable strings
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