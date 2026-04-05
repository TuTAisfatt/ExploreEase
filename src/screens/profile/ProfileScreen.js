import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Alert, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS, TRAVEL_STYLES } from '../../utils/constants';

export default function ProfileScreen({ navigation }) {
  const { user, userProfile, logout, isAdmin, recheckAuth } = useAuth();

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

        {isAdmin && (
          <ActionButton
            label="🛠️   Admin dashboard"
            onPress={() => navigation.navigate('Admin')}
          />
        )}

        <ActionButton
          label="🔒  Privacy & data (GDPR)"
          onPress={() => navigation.navigate('GDPR')}
        />

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
});