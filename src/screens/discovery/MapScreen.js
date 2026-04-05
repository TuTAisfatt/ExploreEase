import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function MapScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>Map view</Text>
      <Text style={styles.subtitle}>
        Map is available on the mobile app only.{'\n'}
        Scan the QR code with Expo Go to use it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 32 },
  backBtn:    { position: 'absolute', top: 52, left: 24 },
  backText:   { fontSize: 15, color: '#1D9E75', fontWeight: '600' },
  emoji:      { fontSize: 64, marginBottom: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
});