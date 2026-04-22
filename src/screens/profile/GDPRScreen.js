import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount } from '../../services/authService';

export default function GDPRScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [password,       setPassword]       = useState('');
  const [deleting,       setDeleting]       = useState(false);

  // ── View personal data ───────────────────────────────────
  function handleViewData() {
    const data = {
      uid:         user?.uid,
      email:       user?.email,
      name:        userProfile?.name,
      age:         userProfile?.age,
      gender:      userProfile?.gender,
      travelStyle: userProfile?.travelStyle,
      interests:   userProfile?.interests?.join(', '),
      createdAt:   userProfile?.createdAt?.toDate?.()?.toLocaleDateString(),
    };

    const readable = Object.entries(data)
      .map(([k, v]) => `${k}: ${v ?? '—'}`)
      .join('\n');

    if (Platform.OS === 'web') {
      window.alert('Your personal data:\n\n' + readable);
    } else {
      Alert.alert('Your personal data', readable);
    }
  }

  // ── Download data ────────────────────────────────────────
  function handleDownloadData() {
    if (Platform.OS === 'web') {
      // Create and download a JSON file on web
      const data = {
        uid:         user?.uid,
        email:       user?.email,
        name:        userProfile?.name,
        age:         userProfile?.age,
        gender:      userProfile?.gender,
        travelStyle: userProfile?.travelStyle,
        interests:   userProfile?.interests,
        createdAt:   userProfile?.createdAt?.toDate?.()?.toLocaleDateString(),
      };
      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
      );
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'my-exploreease-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Send data via EmailJS on mobile
      Alert.alert(
        'Download data',
        'A full data export will be sent to your email address.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async () => {
              try {
                const data = {
                  uid:         user?.uid,
                  email:       user?.email,
                  name:        userProfile?.name,
                  age:         userProfile?.age,
                  gender:      userProfile?.gender,
                  travelStyle: userProfile?.travelStyle,
                  interests:   userProfile?.interests?.join(', '),
                  createdAt:   userProfile?.createdAt?.toDate?.()?.toLocaleDateString(),
                };

                const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    service_id:  'service_ltttq5x',
                    template_id: 'template_ak3sthh',
                    user_id:     'UbVEsfPyXLVAjk1FO',
                    accessToken: 'xEGMzsbTxXZd_TPpL_6iu',
                    template_params: {
                      email:   user?.email,
                      name:    userProfile?.name ?? 'User',
                      title:   'GDPR Data Export',
                      message: JSON.stringify(data, null, 2),
                    },
                  }),
                });

                if (response.ok) {
                  Alert.alert('✅ Sent!', `Your data has been sent to ${user?.email}`);
                } else {
                  Alert.alert('Error', 'Could not send data. Please try again.');
                }
              } catch (e) {
                console.error('GDPR download error:', e);
                Alert.alert('Error', 'Could not send data. Please try again.');
              }
            },
          },
        ]
      );
    }
  }

  // ── Delete account ───────────────────────────────────────
  async function handleDeleteAccount() {
    if (!password.trim()) {
      Alert.alert('Password required', 'Enter your password to confirm deletion.');
      return;
    }

    Alert.alert(
      '⚠️  This cannot be undone',
      'Your account and all personal data will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(password);
              // Auth state changes → AppNavigator sends user back to Login
            } catch (err) {
              const messages = {
                'auth/wrong-password':    'Incorrect password.',
                'auth/too-many-requests': 'Too many attempts. Try again later.',
              };
              Alert.alert(
                'Deletion failed',
                messages[err.code] ?? 'Something went wrong. Please try again.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Data</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* ── Intro ── */}
      <View style={styles.introCard}>
        <Text style={styles.introIcon}>🔒</Text>
        <Text style={styles.introTitle}>Your data, your rights</Text>
        <Text style={styles.introBody}>
          Under GDPR you have the right to view, download, and permanently
          delete all personal data we hold about you.
        </Text>
      </View>

      {/* ── Actions ── */}
      <Text style={styles.sectionLabel}>DATA RIGHTS</Text>

      <View style={styles.actionsCard}>

        {/* View data */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleViewData}
          activeOpacity={0.8}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>👁️</Text>
            <View>
              <Text style={styles.actionTitle}>View my data</Text>
              <Text style={styles.actionSub}>See all info we hold about you</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Download data */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleDownloadData}
          activeOpacity={0.8}
        >
          <View style={styles.actionLeft}>
            <Text style={styles.actionIcon}>📥</Text>
            <View>
              <Text style={styles.actionTitle}>Download my data</Text>
              <Text style={styles.actionSub}>Get a full export sent to your email</Text>
            </View>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

      </View>

      {/* ── Delete account ── */}
      <Text style={styles.sectionLabel}>DANGER ZONE</Text>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Delete my account</Text>
        <Text style={styles.dangerBody}>
          This permanently deletes your account, profile, and all associated
          data. This action cannot be undone.
        </Text>

        {!showDeleteFlow ? (
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => setShowDeleteFlow(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.dangerBtnText}>I want to delete my account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.deleteFlow}>
            <Text style={styles.deleteFlowLabel}>
              Enter your password to confirm:
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="Your password"
              placeholderTextColor="#aaa"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowDeleteFlow(false);
                  setPassword('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteBtn, !password && styles.confirmDeleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={!password || deleting}
                activeOpacity={0.85}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmDeleteBtnText}>Delete forever</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f9fafb' },
  container:      { paddingBottom: 48 },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16 },
  backText:       { fontSize: 15, color: '#1D9E75', fontWeight: '600', width: 60 },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  introCard:      { backgroundColor: '#E1F5EE', marginHorizontal: 20, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 28 },
  introIcon:      { fontSize: 36, marginBottom: 10 },
  introTitle:     { fontSize: 16, fontWeight: '700', color: '#085041', marginBottom: 6 },
  introBody:      { fontSize: 13, color: '#0F6E56', textAlign: 'center', lineHeight: 20 },

  sectionLabel:   { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 0.8, marginHorizontal: 24, marginBottom: 8 },

  actionsCard:    { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 28, overflow: 'hidden' },
  actionRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  actionLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  actionIcon:     { fontSize: 24 },
  actionTitle:    { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  actionSub:      { fontSize: 12, color: '#aaa' },
  actionArrow:    { fontSize: 20, color: '#ccc' },
  divider:        { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 16 },

  dangerCard:     { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#fdd', padding: 20 },
  dangerTitle:    { fontSize: 16, fontWeight: '700', color: '#E24B4A', marginBottom: 8 },
  dangerBody:     { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 16 },
  dangerBtn:      { borderWidth: 1, borderColor: '#E24B4A', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  dangerBtnText:  { color: '#E24B4A', fontSize: 14, fontWeight: '600' },

  deleteFlow:           { gap: 12 },
  deleteFlowLabel:      { fontSize: 13, color: '#555', fontWeight: '600' },
  deleteInput:          { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
  deleteActions:        { flexDirection: 'row', gap: 10 },
  cancelBtn:            { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText:        { color: '#555', fontSize: 14, fontWeight: '600' },
  confirmDeleteBtn:     { flex: 1, backgroundColor: '#E24B4A', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmDeleteBtnDisabled: { backgroundColor: '#f0a0a0' },
  confirmDeleteBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});