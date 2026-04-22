import { Platform } from 'react-native';
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

// ── Send email via EmailJS (platform-aware) ───────────────
async function sendEmail(templateParams) {
  if (Platform.OS === 'web') {
    // Use browser version on web
    const emailjs = require('@emailjs/browser').default;
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
  } else {
    // Use fetch directly on mobile — avoids window.location issue
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id:     PUBLIC_KEY,
        accessToken: 'xEGMzsbTxXZd_TPpL_6iu',
        template_params: templateParams,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EmailJS error: ${text}`);
    }
  }
}

// ─────────────────────────────────────────────
// 1. SEND OTP
// ─────────────────────────────────────────────
export async function sendOTP(email, name) {
  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000;

  await setDoc(doc(db, 'otps', email), {
    otp,
    expires,
    email,
    createdAt: serverTimestamp(),
  });

  await sendEmail({
    email:    email,
    passcode: otp,
    name:     name,
    time:     new Date(expires).toLocaleTimeString(),
  });

  return otp;
}

// ─────────────────────────────────────────────
// 2. VERIFY OTP
// ─────────────────────────────────────────────
export async function verifyOTP(email, enteredCode) {
  const snap = await getDoc(doc(db, 'otps', email));
  if (!snap.exists()) {
    throw new Error('No OTP found. Please request a new code.');
  }
  const { otp, expires } = snap.data();
  if (Date.now() > expires) {
    await deleteDoc(doc(db, 'otps', email));
    throw new Error('Code has expired. Please request a new one.');
  }
  if (enteredCode.trim() !== otp) {
    throw new Error('Incorrect code. Please try again.');
  }
  await deleteDoc(doc(db, 'otps', email));
  return true;
}

// ─────────────────────────────────────────────
// 3. RESEND OTP
// ─────────────────────────────────────────────
export async function resendOTP(email, name) {
  return sendOTP(email, name);
}