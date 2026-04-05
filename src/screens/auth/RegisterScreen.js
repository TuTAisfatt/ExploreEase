import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { registerWithEmail, getFriendlyError } from '../../services/authService';
import { sendOTP } from '../../services/otpService';

// ── Validation helpers ─────────────────────────────────────
const isValidEmail    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isStrongPassword = (v) =>
  v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v);

export default function RegisterScreen({ navigation }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  // Live validation — only show errors after user has typed something
  const emailError    = email    && !isValidEmail(email)
    ? 'Enter a valid email address' : '';
  const passwordError = password && !isStrongPassword(password)
    ? 'Min 8 chars, 1 uppercase letter, 1 number' : '';
  const confirmError  = confirm  && confirm !== password
    ? 'Passwords do not match' : '';

  // All fields valid → enable the button
  const canSubmit =
    name.trim().length > 0   &&
    isValidEmail(email)       &&
    isStrongPassword(password) &&
    password === confirm;

  async function handleRegister() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email.trim(), password);
      await sendOTP(email.trim(), name.trim());

      // Navigate immediately before AuthContext auto-login kicks in
      navigation.navigate('OTP', {
        email:    email.trim(),
        name:     name.trim(),
        password,
      });
    } catch (err) {
      Alert.alert('Registration failed', getFriendlyError(err.code) ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join ExploreEase and start exploring</Text>

        {/* Full name */}
        <Field
          label="Full name"
          placeholder="Jane Doe"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Email */}
        <Field
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
        />

        {/* Password */}
        <Field
          label="Password"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          error={passwordError}
          rightElement={
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          }
        />

        {/* Confirm password */}
        <Field
          label="Confirm password"
          placeholder="Repeat your password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          error={confirmError}
        />

        {/* Password strength hint */}
        {password.length > 0 && (
          <PasswordStrength password={password} />
        )}

        {/* Register button */}
        <TouchableOpacity
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        {/* Login link */}
        <TouchableOpacity
          style={styles.loginWrap}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Reusable field component ───────────────────────────────
function Field({ label, error, rightElement, ...inputProps }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.inputWrap}>
        <TextInput
          style={[
            fieldStyles.input,
            error          ? fieldStyles.inputError : null,
            rightElement   ? fieldStyles.inputWithRight : null,
          ]}
          placeholderTextColor="#aaa"
          autoCorrect={false}
          {...inputProps}
        />
        {rightElement}
      </View>
      {error ? <Text style={fieldStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Password strength bar ──────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password), // special char = bonus
  ];
  const score  = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#E24B4A', '#EF9F27', '#1D9E75', '#0F6E56'];

  return (
    <View style={strengthStyles.wrap}>
      <View style={strengthStyles.bars}>
        {[1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[
              strengthStyles.bar,
              { backgroundColor: i <= score ? colors[score] : '#e0e0e0' },
            ]}
          />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color: colors[score] }]}>
        {labels[score]}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f9fafb' },
  container:   { flexGrow: 1, paddingHorizontal: 28, paddingTop: 56, paddingBottom: 40 },
  backBtn:     { marginBottom: 24 },
  backText:    { fontSize: 15, color: '#1D9E75', fontWeight: '600' },
  title:       { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  subtitle:    { fontSize: 14, color: '#888', marginBottom: 28 },
  eyeBtn:      { position: 'absolute', right: 14, top: 13 },
  eyeText:     { fontSize: 18 },
  btn: {
    backgroundColor: '#1D9E75',
    borderRadius:     12,
    paddingVertical:  15,
    alignItems:       'center',
    marginTop:        8,
    marginBottom:     20,
  },
  btnDisabled: { backgroundColor: '#a0d4c0' },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginWrap:   { alignItems: 'center' },
  loginText:   { fontSize: 14, color: '#888' },
  loginLink:   { color: '#1D9E75', fontWeight: '700' },
});

const fieldStyles = StyleSheet.create({
  wrap:          { marginBottom: 16 },
  label:         { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  inputWrap:     { position: 'relative' },
  input: {
    backgroundColor:  '#fff',
    borderWidth:       1,
    borderColor:       '#e0e0e0',
    borderRadius:      12,
    paddingHorizontal: 16,
    paddingVertical:   13,
    fontSize:          15,
    color:             '#1a1a1a',
  },
  inputError:     { borderColor: '#E24B4A' },
  inputWithRight: { paddingRight: 48 },
  errorText:      { color: '#E24B4A', fontSize: 12, marginTop: 5 },
});

const strengthStyles = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  bars:  { flexDirection: 'row', gap: 4, flex: 1 },
  bar:   { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: '600', minWidth: 44 },
});