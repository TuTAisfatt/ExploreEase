import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { loginWithEmail, loginWithGoogle, getFriendlyError } from '../../services/authService';
import { db } from '../../config/firebase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID     = '601652648520-01ou9ga9op9h2imk5lf7k1phpmachr5p.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID     = '601652648520-cnn4u607pafle6ndgstmrsv440hbtcrs.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '601652648520-nspetnesp1795lgjefaof6ldumatmrt3.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const { recheckAuth } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  // ── Google auth session (mobile only) ─────────────────────
  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  }, { useProxy: true });

  useEffect(() => {
    console.log('Google auth response:', JSON.stringify(response));
    console.log('Redirect URI:', AuthSession.makeRedirectUri({ useProxy: true, projectNameForProxy: 'exploreease' }));
  }, [response]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLoginMobile(id_token);
    }
  }, [response]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  // ── Email login ────────────────────────────────────────────
  async function handleEmailLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const userCredential = await loginWithEmail(email.trim(), password);
      const uid = userCredential.user.uid;

      const snap = await getDoc(doc(db, 'users', uid));
      const profile = snap.data();

      if (profile?.twoFactorEnabled) {
        const { sendOTP } = await import('../../services/otpService');
        await sendOTP(email.trim(), profile?.name ?? '');
        navigation.navigate('OTP', {
          email:    email.trim(),
          password: password,
          mode:     '2fa',
          userId:   uid,
        });
      } else {
        await recheckAuth();
      }
    } catch (err) {
      Alert.alert('Login failed', getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Google login — WEB (uses Firebase popup) ───────────────
  async function handleGoogleLoginWeb() {
    setLoading(true);
    try {
      const auth     = getAuth();
      const provider = new GoogleAuthProvider();
      const result   = await signInWithPopup(auth, provider);
      const user     = result.user;

      // Check if Firestore doc exists — create if new user
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          name:          user.displayName ?? '',
          email:         user.email ?? '',
          profilePicUrl: user.photoURL ?? '',
          age:           null,
          gender:        null,
          travelStyle:   'solo',
          interests:     [],
          isAdmin:       false,
          otpVerified:   true, // Google accounts are pre-verified
          createdAt:     serverTimestamp(),
        });
      } else {
        // Existing user — make sure otpVerified is set
        const profile = snap.data();
        if (!profile.otpVerified) {
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', user.uid), { otpVerified: true });
        }
      }

      await recheckAuth();
    } catch (err) {
      console.error('Google login error:', err);
      Alert.alert('Google sign-in failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Google login — MOBILE ──────────────────────────────────
  async function handleGoogleLoginMobile(idToken) {
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      await recheckAuth();
    } catch (err) {
      Alert.alert('Google sign-in failed', getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Choose correct Google handler based on platform ────────
  function handleGooglePress() {
    if (Platform.OS === 'web') {
      handleGoogleLoginWeb();
    } else {
      promptAsync();
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
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🧭</Text>
          <Text style={styles.logoTitle}>ExploreEase</Text>
          <Text style={styles.logoSub}>Discover your next adventure</Text>
        </View>

        {/* Email field */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password field */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Your password"
              placeholderTextColor="#aaa"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot password */}
        <TouchableOpacity
          style={styles.forgotWrap}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleEmailLogin}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log In</Text>
          }
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google button */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGooglePress}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerWrap}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            Don't have an account?{' '}
            <Text style={styles.registerLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f9fafb' },
  container:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },

  logoWrap:      { alignItems: 'center', marginBottom: 40 },
  logoEmoji:     { fontSize: 54, marginBottom: 8 },
  logoTitle:     { fontSize: 28, fontWeight: '700', color: '#1a1a1a' },
  logoSub:       { fontSize: 14, color: '#888', marginTop: 4 },

  fieldWrap:     { marginBottom: 16 },
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
  },
  passwordWrap:  { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn:        { position: 'absolute', right: 14, top: 13 },
  eyeText:       { fontSize: 18 },

  forgotWrap:    { alignSelf: 'flex-end', marginBottom: 24, marginTop: -4 },
  forgotText:    { fontSize: 13, color: '#1D9E75', fontWeight: '600' },

  btn: {
    backgroundColor: '#1D9E75',
    borderRadius:     12,
    paddingVertical:  15,
    alignItems:       'center',
    marginBottom:     20,
  },
  btnDisabled:   { backgroundColor: '#a0d4c0' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },

  dividerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#e8e8e8' },
  dividerText:   { marginHorizontal: 12, fontSize: 13, color: '#aaa' },

  googleBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#fff',
    borderWidth:      1,
    borderColor:      '#e0e0e0',
    borderRadius:     12,
    paddingVertical:  14,
    marginBottom:     32,
    gap:              10,
  },
  googleIcon:    { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText:    { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },

  registerWrap:  { alignItems: 'center' },
  registerText:  { fontSize: 14, color: '#888' },
  registerLink:  { color: '#1D9E75', fontWeight: '700' },
});