import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useBiometricLock() {
  const [locked,    setLocked]    = useState(false);
  const [checking,  setChecking]  = useState(true);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    // Biometric not supported on web
    if (Platform.OS === 'web') {
      setChecking(false);
      return;
    }

    try {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      if (enabled !== 'true') {
        setChecking(false);
        return;
      }

      // Biometric is enabled — lock the app and prompt
      setLocked(true);
      await authenticate();
    } catch (e) {
      setChecking(false);
    }
  }

  async function authenticate() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock ExploreEase',
        fallbackLabel: 'Use passcode',
        cancelLabel:   'Cancel',
      });

      if (result.success) {
        setLocked(false);
      }
      // If cancelled — stays locked, user must try again
    } catch (e) {
      setLocked(false);
    } finally {
      setChecking(false);
    }
  }

  return { locked, checking, retry: authenticate };
}
