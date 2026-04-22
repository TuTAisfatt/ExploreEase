import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getFollowerCount, getFollowingCount } from '../../services/socialService';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Alert, Platform, Switch,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS, TRAVEL_STYLES } from '../../utils/constants';

export default function ProfileScreen({ navigation }) {
  const { user, userProfile, logout, isAdmin, recheckAuth, refreshProfile } = useAuth();

  const [biometricEnabled,  setBiometricEnabled]  = useState(false);
  const [followerCount,     setFollowerCount]      = useState(0);
  const [followingCount,    setFollowingCount]     = useState(0);

  // Load biometric setting on mount
  useEffect(() => {
    AsyncStorage.getItem('biometricEnabled').then(val => {
      setBiometricEnabled(val === 'true');
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getFollowerCount(user.uid).then(setFollowerCount);
      getFollowingCount(user.uid).then(setFollowingCount);
    }, [user])
  );

  async function handleBiometricToggle(value) {
    if (value) {
      // Test biometric before enabling
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        if (Platform.OS === 'web') {
          window.alert('No biometric authentication available on this device.');
        } else {
          Alert.alert('Not available', 'No biometric authentication found on this device.');
        }
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm your identity to enable biometric lock',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        await AsyncStorage.setItem('biometricEnabled', 'true');
        setBiometricEnabled(true);
      }
    } else {
      await AsyncStorage.setItem('biometricEnabled', 'false');
      setBiometricEnabled(false);
    }
  }

  async function handleTwoFactorToggle(value) {
    try {
      const { updateUserProfile } = await import('../../services/userService');
      await updateUserProfile(user.uid, { twoFactorEnabled: value });
      await refreshProfile();
      const msg = value
        ? "Two-factor auth enabled. You'll need to verify via email on login."
        : 'Two-factor auth disabled.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Updated', msg);
    } catch (e) {
      Alert.alert('Error', 'Could not update 2FA setting.');
    }
  }

  async function handleLogout() {
    // Use window.confirm on web, Alert on mobile
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to log out?')
      : await new Promise(resolve =>
          Alert.alert(
            'Log out',
            'Are you sure you want to log out?',
            [
              { text: 'Cancel',  onPress: () => resolve(false), style: 'cancel' },
              { text: 'Log out', onPress: () => resolve(true),  style: 'destructive' },
            ]
          )
        );

    if (!confirmed) return;

    try {
      await logout();
      await recheckAuth();
    } catch (e) {
      console.error('Logout error:', e);
      if (Platform.OS === 'web') {
        window.alert('Could not log out. Please try again.');
      } else {
        Alert.alert('Error', 'Could not log out. Please try again.');
      }
    }
  }

  const interests   = userProfile?.interests   ?? [];
  const travelStyle = userProfile?.travelStyle ?? 'solo';
  const travelLabel = TRAVEL_STYLES.find(t => t.id === travelStyle)?.label ?? 'Solo';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      {/* ── Avatar + name ── */}
      <View style={styles.avatarSection}>
        {userProfile?.profilePicUrl ? (
          <Image
            source={{ uri: userProfile.profilePicUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {userProfile?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        <Text style={styles.name}>{userProfile?.name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>

        {/* Followers / Following */}
        <View style={styles.followRow}>
          <TouchableOpacity
            style={styles.followStat}
            onPress={() => navigation.navigate('FollowList', { userId: user.uid, type: 'followers' })}
          >
            <Text style={styles.followCount}>{followerCount}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity
            style={styles.followStat}
            onPress={() => navigation.navigate('FollowList', { userId: user.uid, type: 'following' })}
          >
            <Text style={styles.followCount}>{followingCount}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Email verification warning */}
        {user && !user.emailVerified && (
          <View style={styles.verifyBanner}>
            <Text style={styles.verifyText}>
              ⚠️  Email not verified. Check your inbox.
            </Text>
          </View>
        )}
      </View>

      {/* ── Info cards ── */}
      <View style={styles.infoSection}>

        <InfoRow label="Age"          value={userProfile?.age    ?? 'Not set'} />
        <InfoRow label="Gender"       value={userProfile?.gender ?? 'Not set'} />
        <InfoRow label="Travel style" value={travelLabel} />

        {/* Interests */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Interests</Text>
          <View style={styles.tagsWrap}>
            {interests.length > 0 ? (
              interests.map(id => {
                const tag = INTEREST_TAGS.find(t => t.id === id);
                return tag ? (
                  <View key={id} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.label}</Text>
                  </View>
                ) : null;
              })
            ) : (
              <Text style={styles.infoValue}>None selected</Text>
            )}
          </View>
        </View>

      </View>

      {/* ── Action buttons ── */}
      <View style={styles.actionsSection}>

        <ActionButton
          label="✏️   Edit profile"
          onPress={() => navigation.navigate('EditProfile')}
        />

        {userProfile?.role !== 'organizer' && !isAdmin && (
          <ActionButton
            label="🏢  Become an Organizer"
            onPress={() => navigation.navigate('OrganizerRequest')}
          />
        )}

        {userProfile?.role === 'organizer' && (
          <View style={styles.organizerBadgeRow}>
            <Text style={styles.organizerBadgeEmoji}>✅</Text>
            <View>
              <Text style={styles.organizerBadgeTitle}>Organizer Account</Text>
              <Text style={styles.organizerBadgeSub}>You can submit events and attractions</Text>
            </View>
          </View>
        )}

        {isAdmin && (
          <ActionButton
            label="🛠️   Admin dashboard"
            onPress={() => navigation.navigate('AdminDashboard')}
          />
        )}

        <ActionButton
          label="🔒  Privacy & data (GDPR)"
          onPress={() => navigation.navigate('GDPR')}
        />

        {/* Biometric lock toggle */}
        <View style={styles.biometricRow}>
          <View style={styles.biometricLeft}>
            <Text style={styles.biometricIcon}>🔐</Text>
            <View>
              <Text style={styles.biometricTitle}>Biometric lock</Text>
              <Text style={styles.biometricSub}>Require fingerprint/Face ID on open</Text>
            </View>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: '#e0e0e0', true: '#1D9E75' }}
            thumbColor="#fff"
          />
        </View>

        {/* ── 2FA toggle ── */}
        <View style={styles.biometricRow}>
          <View style={styles.biometricLeft}>
            <Text style={styles.biometricIcon}>🔑</Text>
            <View>
              <Text style={styles.biometricTitle}>Two-factor auth</Text>
              <Text style={styles.biometricSub}>Require email OTP on login</Text>
            </View>
          </View>
          <Switch
            value={userProfile?.twoFactorEnabled ?? false}
            onValueChange={handleTwoFactorToggle}
            trackColor={{ false: '#e0e0e0', true: '#1D9E75' }}
            thumbColor="#fff"
          />
        </View>

        <ActionButton
          label="🚪  Log out"
          onPress={handleLogout}
          danger
        />

      </View>

    </ScrollView>
  );
}

// ── Small reusable components ──────────────────────────────

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress, danger = false }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, danger && styles.actionBtnDanger]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.actionBtnText, danger && styles.actionBtnTextDanger]}>
        {label}
      </Text>
      <Text style={styles.actionBtnArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f9fafb' },
  container:       { paddingBottom: 48 },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
  headerTitle:     { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  adminBadge:      { backgroundColor: '#EF9F27', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  adminBadgeText:  { color: '#412402', fontSize: 12, fontWeight: '700' },

  avatarSection:   { alignItems: 'center', paddingVertical: 28 },
  avatar:          { width: 90, height: 90, borderRadius: 45, marginBottom: 14 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarInitial:   { fontSize: 36, fontWeight: '700', color: '#fff' },
  name:            { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  email:           { fontSize: 14, color: '#888', marginBottom: 8 },

  verifyBanner:    { backgroundColor: '#FAEEDA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8, marginHorizontal: 24 },
  verifyText:      { fontSize: 13, color: '#633806' },

  infoSection:     { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 20, overflow: 'hidden' },
  infoRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', flexWrap: 'wrap' },
  infoLabel:       { fontSize: 14, color: '#888', width: 110 },
  infoValue:       { fontSize: 14, color: '#1a1a1a', fontWeight: '500', flex: 1 },

  tagsWrap:        { flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: 6 },
  tag:             { backgroundColor: '#E1F5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:         { fontSize: 12, color: '#0F6E56', fontWeight: '600' },

  actionsSection:  { marginHorizontal: 20, gap: 10 },
  actionBtn:       { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f0f0f0' },
  actionBtnDanger: { borderColor: '#fdd' },
  actionBtnText:   { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  actionBtnTextDanger: { color: '#E24B4A' },
  actionBtnArrow:  { fontSize: 20, color: '#ccc' },

  biometricRow:    { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f0f0f0' },
  biometricLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  biometricIcon:   { fontSize: 22 },
  biometricTitle:  { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  biometricSub:    { fontSize: 12, color: '#aaa', marginTop: 2 },

  organizerBadgeRow:   { backgroundColor: '#E1F5EE', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#c8eedd' },
  organizerBadgeEmoji: { fontSize: 22 },
  organizerBadgeTitle: { fontSize: 15, color: '#0F6E56', fontWeight: '700' },
  organizerBadgeSub:   { fontSize: 12, color: '#1D9E75', marginTop: 2 },

  followRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: '#f0f0f0', gap: 8 },
  followStat:    { flex: 1, alignItems: 'center', gap: 2 },
  followCount:   { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  followLabel:   { fontSize: 12, color: '#1D9E75', fontWeight: '600' },
  followDivider: { width: 1, height: 32, backgroundColor: '#f0f0f0' },
});