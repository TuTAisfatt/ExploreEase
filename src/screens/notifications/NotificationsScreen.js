import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import { timeAgo } from '../../utils/helpers';

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'New event nearby', body: 'Check out the Food Festival this weekend!', type: 'event', createdAt: new Date(Date.now() - 60000 * 30) },
  { id: '2', title: 'Your review was liked', body: 'Someone liked your review at Bitexco Tower.', type: 'review', createdAt: new Date(Date.now() - 60000 * 120) },
  { id: '3', title: 'Welcome to ExploreEase', body: 'Start exploring amazing places around you.', type: 'system', createdAt: new Date(Date.now() - 60000 * 1440) },
];

const iconByType = { event: 'event', review: 'star', system: 'info' };

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const dismissAll = () => setNotifications([]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={dismissAll}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.iconWrap}>
              <MaterialIcons name={iconByType[item.type] ?? 'notifications'} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody}>{item.body}</Text>
              <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={60} color={COLORS.lightGray} />
            <Text style={styles.empty}>No notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  title: { fontSize: SIZES.xxlarge, fontWeight: '700', color: COLORS.text },
  clearText: { color: COLORS.primary, fontSize: SIZES.small },
  list: { padding: SPACING.md, flexGrow: 1 },
  item: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    elevation: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: SIZES.medium, fontWeight: '600', color: COLORS.text },
  itemBody: { fontSize: SIZES.small, color: COLORS.textSecondary, marginTop: 2 },
  itemTime: { fontSize: SIZES.xsmall, color: COLORS.gray, marginTop: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  empty: { color: COLORS.textSecondary, fontSize: SIZES.medium, marginTop: SPACING.sm },
});

export default NotificationsScreen;
