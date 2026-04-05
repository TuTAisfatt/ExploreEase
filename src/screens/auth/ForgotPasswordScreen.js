import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { forgotPassword, getFriendlyError } from '../../services/authService';

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const canSubmit = isValidEmail(email);

  async function handleReset() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true); // show success state instead of alert
    } catch (err) {
      Alert.alert('Error', getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>

        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* ── BEFORE SENDING ── */}
        {!sent ? (
          <>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter the email address linked to your account and
              we'll send you a reset link.
            </Text>

            {/* Email field */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, email && !canSubmit && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            {email && !canSubmit && (
              <Text style={styles.errorText}>Enter a valid email address</Text>
            )}

            {/* Send button */}
            <TouchableOpacity
              style={[styles.btn, !canSubmit && styles.btnDisabled]}
              onPress={handleReset}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </>
        ) : (

          /* ── AFTER SENDING ── */
          <View style={styles.successWrap}>
            <Text style={styles.successEmoji}>✉️</Text>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successBody}>
              We sent a password reset link to{'\n'}
              <Text style={styles.successEmail}>{email.trim()}</Text>
            </Text>
            <Text style={styles.successHint}>
              Didn't receive it? Check your spam folder or try again.
            </Text>

            {/* Resend */}
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => {
                setSent(false);
                setEmail('');
              }}
            >
              <Text style={styles.resendText}>Try a different email</Text>
            </TouchableOpacity>

            {/* Back to login */}
            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f9fafb' },
  container:     { flex: 1, paddingHorizontal: 28, paddingTop: 56 },

  backBtn:       { marginBottom: 32 },
  backText:      { fontSize: 15, color: '#1D9E75', fontWeight: '600' },

  title:         { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle:      { fontSize: 14, color: '#888', lineHeight: 22, marginBottom: 32 },

  label:         { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    backgroundColor:   '#fff',
    borderWidth:        1,
    borderColor:        '#e0e0e0',
    borderRadius:       12,
    paddingHorizontal:  16,
    paddingVertical:    13,
    fontSize:           15,
    color:              '#1a1a1a',
    marginBottom:       6,
  },
  inputError:    { borderColor: '#E24B4A' },
  errorText:     { color: '#E24B4A', fontSize: 12, marginBottom: 16 },

  btn: {
    backgroundColor: '#1D9E75',
    borderRadius:     12,
    paddingVertical:  15,
    alignItems:       'center',
    marginTop:        24,
  },
  btnDisabled:   { backgroundColor: '#a0d4c0' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Success state ──
  successWrap:   { flex: 1, alignItems: 'center', paddingTop: 40 },
  successEmoji:  { fontSize: 64, marginBottom: 24 },
  successTitle:  { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  successBody:   { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  successEmail:  { fontWeight: '700', color: '#1a1a1a' },
  successHint:   { fontSize: 13, color: '#aaa', textAlign: 'center', marginBottom: 32 },

  resendBtn:     { marginTop: 16 },
  resendText:    { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
});