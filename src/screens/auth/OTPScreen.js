import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { verifyOTP, resendOTP } from '../../services/otpService';
import { useAuth } from '../../context/AuthContext';

export default function OTPScreen({ navigation, route }) {
  const { email, name, password } = route.params;
  const { recheckAuth } = useAuth();

  const [code,        setCode]        = useState(['', '', '', '', '', '']);
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [countdown,   setCountdown]   = useState(60);
  const [canResend,   setCanResend]   = useState(false);

  const inputs = useRef([]);

  // ── Countdown timer for resend button ───────────────────
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ── Handle each digit input ──────────────────────────────
  function handleChange(text, index) {
    // Only allow numbers
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const fullCode = [...newCode].join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  }

  // ── Handle backspace ─────────────────────────────────────
  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  // ── Verify OTP ───────────────────────────────────────────
  async function handleVerify(fullCode) {
    const enteredCode = fullCode ?? code.join('');
    if (enteredCode.length < 6) {
      return Alert.alert('Enter all 6 digits');
    }
    setLoading(true);
    try {
      await verifyOTP(email, enteredCode);

      // Mark as verified in Firestore
      const { getAuth } = await import('firebase/auth');
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          otpVerified: true,
        });
      }

      // Re-check auth state — this will navigate to home automatically
      await recheckAuth();
    } catch (err) {
      Alert.alert('Verification failed', err.message);
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ───────────────────────────────────────────
  async function handleResend() {
    if (!canResend) return;
    setResending(true);
    try {
      await resendOTP(email, name);
      setCountdown(60);
      setCanResend(false);
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      Alert.alert('Code sent!', `A new code was sent to ${email}`);
    } catch (err) {
      Alert.alert('Error', 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  const filledDigits = code.filter(d => d !== '').length;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* ── Icon + title ── */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✉️</Text>
      </View>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit verification code to
      </Text>
      <Text style={styles.email}>{email}</Text>

      {/* ── OTP input boxes ── */}
      <View style={styles.codeRow}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={ref => (inputs.current[index] = ref)}
            style={[
              styles.codeBox,
              digit ? styles.codeBoxFilled : null,
            ]}
            value={digit}
            onChangeText={text => handleChange(text, index)}
            onKeyPress={e => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </View>

      {/* ── Verify button ── */}
      <TouchableOpacity
        style={[
          styles.btn,
          filledDigits < 6 && styles.btnDisabled,
        ]}
        onPress={() => handleVerify()}
        disabled={filledDigits < 6 || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Verify Email</Text>
        }
      </TouchableOpacity>

      {/* ── Resend ── */}
      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>Didn't receive the code? </Text>
        {canResend ? (
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            {resending
              ? <ActivityIndicator size="small" color="#1D9E75" />
              : <Text style={styles.resendLink}>Resend code</Text>
            }
          </TouchableOpacity>
        ) : (
          <Text style={styles.resendCountdown}>
            Resend in {countdown}s
          </Text>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 28, paddingTop: 56 },

  backBtn:          { marginBottom: 32 },
  backText:         { fontSize: 15, color: '#1D9E75', fontWeight: '600' },

  iconWrap:         { alignItems: 'center', marginBottom: 20 },
  icon:             { fontSize: 64 },
  title:            { fontSize: 26, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 8 },
  subtitle:         { fontSize: 14, color: '#888', textAlign: 'center' },
  email:            { fontSize: 15, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 36 },

  codeRow:          { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  codeBox: {
    width:            48,
    height:           56,
    borderRadius:     12,
    borderWidth:      1.5,
    borderColor:      '#e0e0e0',
    backgroundColor:  '#fff',
    textAlign:        'center',
    fontSize:         22,
    fontWeight:       '700',
    color:            '#1a1a1a',
  },
  codeBoxFilled:    { borderColor: '#1D9E75', backgroundColor: '#E1F5EE' },

  btn: {
    backgroundColor: '#1D9E75',
    borderRadius:     12,
    paddingVertical:  15,
    alignItems:       'center',
    marginBottom:     24,
  },
  btnDisabled:      { backgroundColor: '#a0d4c0' },
  btnText:          { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendRow:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel:      { fontSize: 14, color: '#888' },
  resendLink:       { fontSize: 14, color: '#1D9E75', fontWeight: '700' },
  resendCountdown:  { fontSize: 14, color: '#aaa' },
});