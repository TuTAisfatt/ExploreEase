import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES, SPACING } from '../utils/constants';
import StarRating from './StarRating';
import { timeAgo } from '../utils/helpers';

const ReviewItem = ({ item }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Image
        source={{ uri: item.userPhoto || 'https://via.placeholder.com/40' }}
        style={styles.avatar}
      />
      <View style={styles.headerInfo}>
        <Text style={styles.userName}>{item.userName || 'Anonymous'}</Text>
        <Text style={styles.date}>{timeAgo(item.createdAt)}</Text>
      </View>
      <StarRating rating={item.rating} size={14} readonly />
    </View>
    {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
  headerInfo: { flex: 1 },
  userName: { fontSize: SIZES.medium, fontWeight: '600', color: COLORS.text },
  date: { fontSize: SIZES.xsmall, color: COLORS.gray },
  comment: { marginTop: SPACING.xs, fontSize: SIZES.medium, color: COLORS.textSecondary },
});

export default ReviewItem;
