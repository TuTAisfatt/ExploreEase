import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Alert,
  KeyboardAvoidingView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { createAttraction, updateAttraction, getAttractionById } from '../../services/attractionService';

const CATEGORIES = [
  { id: 'food',      label: '🍜 Food'      },
  { id: 'culture',   label: '🏛️ Culture'   },
  { id: 'shopping',  label: '🛍️ Shopping'  },
  { id: 'adventure', label: '⛺ Adventure' },
  { id: 'nature',    label: '🌿 Nature'    },
];

export default function CreateAttractionScreen({ navigation, route }) {
  const { user } = useAuth();
  const editMode     = route?.params?.editMode ?? false;
  const attractionId = route?.params?.attractionId ?? null;

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState(null);
  const [address,     setAddress]     = useState('');
  const [hours,       setHours]       = useState('');
  const [priceLevel,  setPriceLevel]  = useState('0');
  const [imageUrl,    setImageUrl]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [loadingData, setLoadingData] = useState(editMode);

  // Load existing data in edit mode
  useEffect(() => {
    if (!editMode || !attractionId) return;
    (async () => {
      try {
        const data = await getAttractionById(attractionId);
        if (data) {
          setName(data.name ?? '');
          setDescription(data.description ?? '');
          setCategory(data.category ?? null);
          setAddress(data.address ?? '');
          setHours(data.hours ?? '');
          setPriceLevel(String(data.priceLevel ?? 0));
          setImageUrl(data.images?.[0] ?? '');
        }
      } catch (e) {
        console.error('Load attraction error:', e);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [editMode, attractionId]);

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType?.Images ?? ImagePicker.MediaTypeOptions?.Images ?? 'Images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: Platform.OS !== 'web',
    });
    if (!result.canceled) {
      try {
        setLoading(true);
        const asset    = result.assets[0];
        const mime     = asset.mimeType ?? 'image/jpeg';
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob     = await response.blob();
          formData.append('file', blob);
        } else {
          formData.append('file', `data:${mime};base64,${asset.base64}`);
        }
        formData.append('upload_preset', 'exploreease_reviews');
        const res  = await fetch('https://api.cloudinary.com/v1_1/dpmtwyqg6/image/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) setImageUrl(data.secure_url);
        else Alert.alert('Upload failed', 'Could not upload image.');
      } catch (e) {
        Alert.alert('Error', 'Could not upload image.');
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleSubmit() {
    if (!name.trim())    return Alert.alert('Missing field', 'Please enter a name.');
    if (!category)       return Alert.alert('Missing field', 'Please select a category.');
    if (!address.trim()) return Alert.alert('Missing field', 'Please enter an address.');

    // Geocode address using Photon (free, no API key)
    let location = null;
    try {
      const geoRes  = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(address.trim())}&limit=1`
      );
      const geoData = await geoRes.json();
      const feature = geoData?.features?.[0];
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        location = { latitude: lat, longitude: lng };
      } else {
        Alert.alert(
          'Address not found',
          'Could not find coordinates for this address. Try a more specific address.'
        );
      }
    } catch (e) {
      console.warn('Geocoding failed:', e);
    }

    setLoading(true);
    try {
      const data = {
        name:        name.trim(),
        nameLower:   name.trim().toLowerCase(),
        description: description.trim(),
        category,
        address:     address.trim(),
        hours:       hours.trim() || null,
        priceLevel:  parseInt(priceLevel) || 0,
        images:      imageUrl ? [imageUrl] : [],
        location,
        createdBy:   user.uid,
        approved:    false,
      };

      if (editMode && attractionId) {
        await updateAttraction(attractionId, data);
        const msg = 'Attraction updated successfully!';
        if (Platform.OS === 'web') { window.alert(msg); navigation.goBack(); }
        else Alert.alert('Updated!', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await createAttraction(data);
        const msg = 'Your attraction has been submitted for admin approval.';
        if (Platform.OS === 'web') { window.alert(msg); navigation.goBack(); }
        else Alert.alert('Submitted!', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>{editMode ? 'Edit Attraction' : 'Add Attraction'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.noticeBanner}>
          <Text style={styles.noticeEmoji}>ℹ️</Text>
          <Text style={styles.noticeText}>
            {editMode ? 'Update your attraction details below.' : 'Attractions require admin approval before appearing publicly.'}
          </Text>
        </View>

        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. Jade Emperor Pagoda" placeholderTextColor="#aaa" value={name} onChangeText={setName} />

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

        <Text style={styles.label}>Address *</Text>
        <TextInput style={styles.input} placeholder="e.g. 73 Mai Thi Luu, District 1" placeholderTextColor="#aaa" value={address} onChangeText={setAddress} />

        <Text style={styles.label}>Opening Hours (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. 7:00 AM – 6:00 PM" placeholderTextColor="#aaa" value={hours} onChangeText={setHours} autoCapitalize="none" />

        <Text style={styles.label}>Price Level</Text>
        <View style={styles.categoryRow}>
          {[['0','Free'],['1','$'],['2','$$'],['3','$$$']].map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.categoryChip, priceLevel === val && styles.categoryChipActive]}
              onPress={() => setPriceLevel(val)}
            >
              <Text style={[styles.categoryChipText, priceLevel === val && styles.categoryChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Photo (optional)</Text>
        {imageUrl ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUrl('')}>
              <Text style={styles.removeImageText}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} disabled={loading}>
            <Text style={styles.imagePickerIcon}>📷</Text>
            <Text style={styles.imagePickerText}>Add photo</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textarea]} placeholder="Describe this place..." placeholderTextColor="#aaa" value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>{editMode ? 'Save Changes' : 'Submit for Approval'}</Text>
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
  centered:               { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  imagePreview:           { width: '100%', height: 180, borderRadius: 12 },
  imageWrap:              { position: 'relative', marginTop: 4 },
  removeImageBtn:         { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  removeImageText:        { color: '#fff', fontSize: 11, fontWeight: '600' },
  imagePickerBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingVertical: 16, gap: 8, borderStyle: 'dashed', marginTop: 4 },
  imagePickerIcon:        { fontSize: 20 },
  imagePickerText:        { fontSize: 14, color: '#555', fontWeight: '500' },
  submitBtn:              { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnDisabled:      { backgroundColor: '#a0d4c0' },
  submitBtnText:          { color: '#fff', fontWeight: '700', fontSize: 16 },
});
