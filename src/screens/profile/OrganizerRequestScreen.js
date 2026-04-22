import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform,
  ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function OrganizerRequestScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [orgName,      setOrgName]      = useState('');
  const [orgType,      setOrgType]      = useState('business'); // 'business' | 'individual'
  const [description,  setDescription]  = useState('');
  const [website,      setWebsite]      = useState('');
  const [loading,      setLoading]      = useState(false);

  const ORG_TYPES = [
    { id: 'business',    label: '🏢 Business'    },
    { id: 'individual',  label: '👤 Individual'  },
    { id: 'ngo',         label: '🤝 NGO/Nonprofit' },
    { id: 'government',  label: '🏛️ Government'  },
  ];

  async function handleSubmit() {
    if (!orgName.trim()) {
      return Alert.alert('Required', 'Please enter your organization name.');
    }
    if (!description.trim()) {
      return Alert.alert('Required', 'Please describe your organization.');
    }

    setLoading(true);
    try {
      // Check if already has pending request
      const q = query(
        collection(db, 'organizerRequests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        Alert.alert(
          'Already submitted',
          'You already have a pending organizer request. Please wait for admin review.'
        );
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'organizerRequests'), {
        userId:      user.uid,
        userName:    userProfile?.name ?? '',
        userEmail:   user.email ?? '',
        orgName:     orgName.trim(),
        orgType,
        description: description.trim(),
        website:     website.trim() || null,
        status:      'pending',
        createdAt:   serverTimestamp(),
      });

      const msg = 'Your organizer request has been submitted! We\'ll review it and notify you soon.';
      if (Platform.OS === 'web') {
        window.alert(msg);
        navigation.goBack();
      } else {
        Alert.alert('Submitted! 🎉', msg, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      console.error('OrganizerRequest error:', e);
      Alert.alert('Error', 'Could not submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Become an Organizer</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoEmoji}>📋</Text>
          <Text style={styles.infoText}>
            As an organizer you can submit events and attractions for admin approval. Fill in the form below to apply.
          </Text>
        </View>

        {/* ── Org type ── */}
        <Text style={styles.label}>Organization Type *</Text>
        <View style={styles.typeRow}>
          {ORG_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeChip, orgType === type.id && styles.typeChipActive]}
              onPress={() => setOrgType(type.id)}
            >
              <Text style={[styles.typeChipText, orgType === type.id && styles.typeChipTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Org name ── */}
        <Text style={styles.label}>Organization / Business Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Saigon Tours Co."
          placeholderTextColor="#aaa"
          value={orgName}
          onChangeText={setOrgName}
          autoCapitalize="words"
        />

        {/* ── Description ── */}
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Tell us about your organization and what kind of events/places you want to list..."
          placeholderTextColor="#aaa"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* ── Website ── */}
        <Text style={styles.label}>Website (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://yourwebsite.com"
          placeholderTextColor="#aaa"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Request</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#f9fafb' },
  content:             { paddingHorizontal: 20, paddingBottom: 40 },

  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 16 },
  backBtn:             { padding: 8 },
  backText:            { fontSize: 22, color: '#1a1a1a' },
  heading:             { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },

  infoBanner:          { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E1F5EE', borderRadius: 12, padding: 14, marginBottom: 24, gap: 10 },
  infoEmoji:           { fontSize: 20 },
  infoText:            { flex: 1, fontSize: 13, color: '#0F6E56', lineHeight: 20 },

  label:               { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 16 },
  input:               { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a' },
  textarea:            { minHeight: 100, paddingTop: 12 },

  typeRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  typeChipActive:      { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  typeChipText:        { fontSize: 13, color: '#555' },
  typeChipTextActive:  { color: '#fff', fontWeight: '600' },

  submitBtn:           { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled:   { backgroundColor: '#a0d4c0' },
  submitBtnText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
});
