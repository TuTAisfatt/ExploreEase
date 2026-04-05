import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

const StarRating = ({ rating = 0, maxStars = 5, size = 20, onRate, readonly = false }) => (
  <View style={styles.row}>
    {Array.from({ length: maxStars }, (_, i) => {
      const filled = i < Math.round(rating);
      return readonly ? (
        <MaterialIcons
          key={i}
          name={filled ? 'star' : 'star-border'}
          size={size}
          color={filled ? COLORS.secondary : COLORS.gray}
        />
      ) : (
        <TouchableOpacity key={i} onPress={() => onRate && onRate(i + 1)}>
          <MaterialIcons
            name={filled ? 'star' : 'star-border'}
            size={size}
            color={filled ? COLORS.secondary : COLORS.gray}
          />
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

export default StarRating;
