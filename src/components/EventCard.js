import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../utils/constants';
import { formatDate, truncateText } from '../utils/helpers';

const EventCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <Image
      source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x200' }}
      style={styles.image}
    />
    <View style={styles.info}>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <View style={styles.row}>
        <MaterialIcons name="event" size={14} color={COLORS.primary} />
        <Text style={styles.meta}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.row}>
        <MaterialIcons name="location-on" size={14} color={COLORS.secondary} />
        <Text style={styles.meta}>{truncateText(item.location, 40)}</Text>
      </View>
      <View style={styles.row}>
        <MaterialIcons name="people" size={14} color={COLORS.gray} />
        <Text style={styles.meta}>{item.attendees?.length ?? 0} attending</Text>
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
  image: { width: '100%', height: 140 },
  info: { padding: SPACING.sm },
  title: { fontSize: SIZES.large, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  meta: { fontSize: SIZES.small, color: COLORS.textSecondary, marginLeft: 4 },
});

export default EventCard;
