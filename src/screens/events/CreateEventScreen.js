import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createEvent } from '../../services/eventService';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const CreateEventScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !location.trim() || !date.trim()) {
      Alert.alert('Error', 'Title, location and date are required.');
      return;
    }
    setLoading(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: new Date(date),
        imageUrl: imageUrl.trim(),
        createdBy: user.uid,
        creatorName: userProfile?.displayName ?? '',
      });
      Alert.alert('Success', 'Event created!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Create Event</Text>

          {[
            { label: 'Event Title', value: title, onChange: setTitle, placeholder: 'Enter event title' },
            { label: 'Location', value: location, onChange: setLocation, placeholder: 'Enter location' },
            { label: 'Date (YYYY-MM-DD HH:MM)', value: date, onChange: setDate, placeholder: '2025-12-31 18:00' },
            { label: 'Image URL (optional)', value: imageUrl, onChange: setImageUrl, placeholder: 'https://...' },
          ].map((field) => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={field.placeholder}
              />
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the event..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Event'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  content: { padding: SPACING.md },
  heading: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  fieldGroup: { marginBottom: SPACING.md },
  label: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: SIZES.medium,
  },
  textarea: { minHeight: 100 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.medium },
});

export default CreateEventScreen;
