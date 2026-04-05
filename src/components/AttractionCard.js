import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../utils/constants';
import StarRating from './StarRating';
import { truncateText } from '../utils/helpers';

const AttractionCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <Image
      source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x200' }}
      style={styles.image}
    />
    <View style={styles.info}>
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <View style={styles.row}>
        <MaterialIcons name="location-on" size={14} color={COLORS.primary} />
        <Text style={styles.address}>{truncateText(item.address, 40)}</Text>
      </View>
      <View style={styles.row}>
        <StarRating rating={item.rating} size={14} readonly />
        <Text style={styles.reviewCount}>({item.reviewCount ?? 0})</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: { width: '100%', height: 160 },
  info: { padding: SPACING.sm },
  name: { fontSize: SIZES.large, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  address: { fontSize: SIZES.small, color: COLORS.textSecondary, marginLeft: 2 },
  reviewCount: { fontSize: SIZES.small, color: COLORS.textSecondary, marginLeft: 4 },
});

export default AttractionCard;
