import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile, uploadProfilePicture } from '../../services/userService';
import { INTEREST_TAGS, TRAVEL_STYLES } from '../../utils/constants';

export default function EditProfileScreen({ navigation }) {
  const { user, userProfile, refreshProfile } = useAuth();

  // Pre-fill fields with current profile data
  const [name,        setName]        = useState(userProfile?.name        ?? '');
  const [age,         setAge]         = useState(userProfile?.age?.toString() ?? '');
  const [gender,      setGender]      = useState(userProfile?.gender      ?? '');
  const [travelStyle, setTravelStyle] = useState(userProfile?.travelStyle ?? 'solo');
  const [interests,   setInterests]   = useState(userProfile?.interests   ?? []);
  const [avatarUri,   setAvatarUri]   = useState(userProfile?.profilePicUrl ?? '');
  const [loading,     setLoading]     = useState(false);

  // ── Toggle an interest on/off ────────────────────────────
  function toggleInterest(id) {
    setInterests(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }

  // ── Pick profile picture from library ───────────────────
  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],   // square crop
      quality: 0.7,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  // ── Biometric check before saving ───────────────────────
  async function checkBiometric() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

    // If device has no biometrics set up, skip and allow save
    if (!hasHardware || !isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm your identity to save changes',
      fallbackLabel: 'Use passcode',
    });
    return result.success;
  }

  // ── Save profile ─────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    // Optional biometric confirmation
    const confirmed = await checkBiometric();
    if (!confirmed) {
      Alert.alert('Authentication failed', 'Could not verify your identity.');
      return;
    }

    setLoading(true);
    try {
      // Upload new profile picture if user picked one
      if (avatarUri && avatarUri !== userProfile?.profilePicUrl) {
        await uploadProfilePicture(user.uid, avatarUri);
      }

      // Save all profile fields to Firestore
      await updateUserProfile(user.uid, {
        name:        name.trim(),
        age:         age ? parseInt(age, 10) : null,
        gender:      gender || null,
        travelStyle,
        interests,
      });

      // Refresh AuthContext so ProfileScreen shows updated data immediately
      await refreshProfile();

      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* ── Avatar picker ── */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditText}>📷</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </View>

      {/* ── Basic info ── */}
      <Section title="Basic info">

        <Field
          label="Full name *"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
        />

        <Field
          label="Age (optional)"
          value={age}
          onChangeText={v => setAge(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 25"
          keyboardType="numeric"
          maxLength={3}
        />

        {/* Gender — optional, free text */}
        <Field
          label="Gender (optional)"
          value={gender}
          onChangeText={setGender}
          placeholder="e.g. Male, Female, Non-binary…"
          autoCapitalize="words"
        />

      </Section>

      {/* ── Travel style ── */}
      <Section title="Travel style">
        <View style={styles.optionsRow}>
          {TRAVEL_STYLES.map(style => (
            <TouchableOpacity
              key={style.id}
              style={[
                styles.optionChip,
                travelStyle === style.id && styles.optionChipActive,
              ]}
              onPress={() => setTravelStyle(style.id)}
            >
              <Text style={[
                styles.optionChipText,
                travelStyle === style.id && styles.optionChipTextActive,
              ]}>
                {style.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* ── Interests ── */}
      <Section title="Interests">
        <Text style={styles.sectionHint}>Select all that apply</Text>
        <View style={styles.optionsRow}>
          {INTEREST_TAGS.map(tag => (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.optionChip,
                interests.includes(tag.id) && styles.optionChipActive,
              ]}
              onPress={() => toggleInterest(tag.id)}
            >
              <Text style={[
                styles.optionChipText,
                interests.includes(tag.id) && styles.optionChipTextActive,
              ]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* ── Save button ── */}
      <TouchableOpacity
        style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save Changes</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Reusable section wrapper ───────────────────────────────
function Section({ title, children }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

// ── Reusable text field ────────────────────────────────────
function Field({ label, ...inputProps }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        placeholderTextColor="#aaa"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: '#f9fafb' },
  container:          { paddingBottom: 48 },

  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16 },
  backText:           { fontSize: 15, color: '#1D9E75', fontWeight: '600', width: 60 },
  headerTitle:        { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  avatarSection:      { alignItems: 'center', paddingVertical: 20 },
  avatar:             { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder:  { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  avatarInitial:      { fontSize: 36, fontWeight: '700', color: '#fff' },
  avatarEditBadge:    { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  avatarEditText:     { fontSize: 14 },
  avatarHint:         { marginTop: 8, fontSize: 12, color: '#aaa' },

  optionsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e8e8e8' },
  optionChipActive:   { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  optionChipText:     { fontSize: 13, color: '#555', fontWeight: '500' },
  optionChipTextActive: { color: '#fff', fontWeight: '700' },

  sectionHint:        { fontSize: 12, color: '#aaa', marginBottom: 10 },

  saveBtn:            { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginTop: 8 },
  saveBtnDisabled:    { backgroundColor: '#a0d4c0' },
  saveBtnText:        { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const sectionStyles = StyleSheet.create({
  wrap:   { marginHorizontal: 20, marginBottom: 20 },
  title:  { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f0f0f0', gap: 4 },
});

const fieldStyles = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1a1a1a' },
});