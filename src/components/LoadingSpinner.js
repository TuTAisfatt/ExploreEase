import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '../utils/constants';

const LoadingSpinner = ({ size = 'large', color = COLORS.primary, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size={size} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoadingSpinner;
