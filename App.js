import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { useBiometricLock } from './src/hooks/useBiometricLock';

function AppContent() {
  const { locked, checking, retry } = useBiometricLock();

  if (checking) {
    return (
      <View style={styles.lockScreen}>
        <ActivityIndicator size="large" color="#1D9E75" />
      </View>
    );
  }

  if (locked) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockEmoji}>🔐</Text>
        <Text style={styles.lockTitle}>ExploreEase is locked</Text>
        <Text style={styles.lockSub}>Authenticate to continue</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={retry}>
          <Text style={styles.unlockBtnText}>Unlock with biometrics</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  lockScreen:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', gap: 12 },
  lockEmoji:     { fontSize: 64, marginBottom: 8 },
  lockTitle:     { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  lockSub:       { fontSize: 14, color: '#888', marginBottom: 16 },
  unlockBtn:     { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  unlockBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
