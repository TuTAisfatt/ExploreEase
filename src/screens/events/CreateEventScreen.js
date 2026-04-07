import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Alert,
  KeyboardAvoidingView, Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { createEvent } from '../../services/eventService';
import { Timestamp } from 'firebase/firestore';

const CATEGORIES = [
  { id: 'food',      label: '🍜 Food'      },
  { id: 'culture',   label: '🏛️ Culture'   },
  { id: 'shopping',  label: '🛍️ Shopping'  },
  { id: 'adventure', label: '⛺ Adventure' },
  { id: 'nature',    label: '🌿 Nature'    },
];

export default function CreateEventScreen({ navigation, route }) {
  const { user } = useAuth();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState(null);
  const [address,     setAddress]     = useState('');
  const [imageUrl,    setImageUrl]    = useState('');
  const [price,       setPrice]       = useState('0');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [loading,     setLoading]     = useState(false);

  function parseDate(str) {
    // Accept: YYYY-MM-DD HH:MM
    const d = new Date(str.replace(' ', 'T'));
    if (isNaN(d.getTime())) throw new Error(`Invalid date: "${str}"`);
    return d;
  }

  async function handleCreate() {
    // ── Validation ──────────────────────────────────────────
    if (!title.trim()) {
      return Alert.alert('Missing field', 'Please enter an event title.');
    }
    if (!category) {
      return Alert.alert('Missing field', 'Please select a category.');
    }
    if (!address.trim()) {
      return Alert.alert('Missing field', 'Please enter a location.');
    }
    if (!startDate.trim() || !endDate.trim()) {
      return Alert.alert('Missing field', 'Please enter start and end date.');
    }

    let start, end;
    try {
      start = parseDate(startDate.trim());
      end   = parseDate(endDate.trim());
    } catch (e) {
      return Alert.alert('Invalid date', 'Use format: YYYY-MM-DD HH:MM\nExample: 2025-12-31 18:00');
    }

    if (end <= start) {
      return Alert.alert('Invalid dates', 'End date must be after start date.');
    }

    const priceNum = parseFloat(price) || 0;

    setLoading(true);
    try {
      await createEvent(user.uid, {
        title:       title.trim(),
        description: description.trim(),
        category,
        address:     address.trim(),
        imageUrl:    imageUrl.trim(),
        price:       priceNum,
        startDate:   Timestamp.fromDate(start),
        endDate:     Timestamp.fromDate(end),
        approved:    false,
      });

      const msg = 'Your event has been submitted for admin approval. It will appear once approved.';
      if (Platform.OS === 'web') {
        window.alert(msg);
        navigation.goBack();
      } else {
        Alert.alert('Submitted!', msg, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
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
          <Text style={styles.heading}>Create Event</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Admin approval notice ── */}
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeEmoji}>ℹ️</Text>
          <Text style={styles.noticeText}>
            Events require admin approval before appearing publicly.
          </Text>
        </View>

        {/* ── Title ── */}
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Saigon Food Tour"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
        />

        {/* ── Category ── */}
        <Text style={styles.label}>Category *</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={[styles.categoryChipText, category === cat.id && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Location ── */}
        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Ben Thanh Market, District 1"
          placeholderTextColor="#aaa"
          value={address}
          onChangeText={setAddress}
        />

        {/* ── Start date ── */}
        <Text style={styles.label}>Start Date & Time * (YYYY-MM-DD HH:MM)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2025-12-31 18:00"
          placeholderTextColor="#aaa"
          value={startDate}
          onChangeText={setStartDate}
          autoCapitalize="none"
        />

        {/* ── End date ── */}
        <Text style={styles.label}>End Date & Time * (YYYY-MM-DD HH:MM)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2025-12-31 21:00"
          placeholderTextColor="#aaa"
          value={endDate}
          onChangeText={setEndDate}
          autoCapitalize="none"
        />

        {/* ── Price ── */}
        <Text style={styles.label}>Price (₫) — enter 0 for free</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#aaa"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        {/* ── Image URL ── */}
        <Text style={styles.label}>Image URL (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#aaa"
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {imageUrl.trim().length > 0 && (
          <Image
            source={{ uri: imageUrl.trim() }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        )}

        {/* ── Description ── */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Tell people what this event is about..."
          placeholderTextColor="#aaa"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit for Approval</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#f9fafb' },
  content:                { paddingHorizontal: 20, paddingBottom: 40 },

  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 16 },
  backBtn:                { padding: 8 },
  backText:               { fontSize: 22, color: '#1a1a1a' },
  heading:                { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },

  noticeBanner:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E1F5EE', borderRadius: 12, padding: 12, marginBottom: 20, gap: 8 },
  noticeEmoji:            { fontSize: 18 },
  noticeText:             { flex: 1, fontSize: 13, color: '#0F6E56', lineHeight: 18 },

  label:                  { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 14 },
  input:                  { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a' },
  textarea:               { minHeight: 100, paddingTop: 12 },

  categoryRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  categoryChipActive:     { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  categoryChipText:       { fontSize: 13, color: '#555' },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },

  imagePreview:           { width: '100%', height: 180, borderRadius: 12, marginTop: 8 },

  submitBtn:              { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled:      { backgroundColor: '#a0d4c0' },
  submitBtnText:          { color: '#fff', fontWeight: '700', fontSize: 16 },
});
