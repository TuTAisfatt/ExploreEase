import emailjs from '@emailjs/browser';
import {
  doc, setDoc, getDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ── EmailJS credentials ────────────────────────────────────
const SERVICE_ID  = 'service_ltttq5x';
const TEMPLATE_ID = 'template_lftoj5y';
const PUBLIC_KEY  = 'UbVEsfPyXLVAjk1FO';

// ── Generate a random 6-digit OTP ─────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─────────────────────────────────────────────
// 1. SEND OTP — generates code, saves to
//    Firestore, sends email via EmailJS
// ─────────────────────────────────────────────
export async function sendOTP(email, name) {
  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

  // Save OTP to Firestore under 'otps' collection
  await setDoc(doc(db, 'otps', email), {
    otp,
    expires,
    email,
    createdAt: serverTimestamp(),
  });

  // Send email via EmailJS
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      email:      email,   // matches {{email}} in template To field
      passcode:   otp,     // matches {{passcode}} in template body
      name:       name,    // matches {{name}} in template
      time:       new Date(expires).toLocaleTimeString(),
    },
    PUBLIC_KEY
  );

  return otp; // return for dev testing only — remove in production
}

// ─────────────────────────────────────────────
// 2. VERIFY OTP — checks code against Firestore
// ─────────────────────────────────────────────
export async function verifyOTP(email, enteredCode) {
  const snap = await getDoc(doc(db, 'otps', email));

  if (!snap.exists()) {
    throw new Error('No OTP found. Please request a new code.');
  }

  const { otp, expires } = snap.data();

  // Check expiry
  if (Date.now() > expires) {
    await deleteDoc(doc(db, 'otps', email));
    throw new Error('Code has expired. Please request a new one.');
  }

  // Check code
  if (enteredCode.trim() !== otp) {
    throw new Error('Incorrect code. Please try again.');
  }

  // OTP is correct — delete it so it can't be reused
  await deleteDoc(doc(db, 'otps', email));
  return true;
}

// ─────────────────────────────────────────────
// 3. RESEND OTP
// ─────────────────────────────────────────────
export async function resendOTP(email, name) {
  return sendOTP(email, name);
}