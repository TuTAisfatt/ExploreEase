import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, deleteAllNotifications,
} from '../../services/notificationService';

const CATEGORIES = [
  { id: null,      label: '🔔 All'      },
  { id: 'alert',   label: '⚠️ Alerts'   },
  { id: 'event',   label: '📅 Events'   },
  { id: 'offer',   label: '🎁 Offers'   },
  { id: 'message', label: '💬 Messages' },
  { id: 'system',  label: 'ℹ️ System'   },
];

const TYPE_EMOJI = {
  alert:   '⚠️',
  event:   '📅',
  offer:   '🎁',
  message: '💬',
  system:  'ℹ️',
  review:  '⭐',
};

export default function NotificationsScreen() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getNotifications(user.uid);
      setNotifications(data);
    } catch (e) {
      console.error('fetchNotifications error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // ── Filter by category ────────────────────────────────────
  const filtered = activeCategory
    ? notifications.filter(n => n.type === activeCategory)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Mark as read when tapped ──────────────────────────────
  async function handleTap(notif) {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
  }

  // ── Delete single ─────────────────────────────────────────
  async function handleDelete(notifId) {
    await deleteNotification(notifId);
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  }

  // ── Mark all read ─────────────────────────────────────────
  async function handleMarkAllRead() {
    await markAllNotificationsRead(user.uid);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  // ── Clear all ─────────────────────────────────────────────
  async function handleClearAll() {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Clear all notifications?')
      : await new Promise(resolve =>
          Alert.alert('Clear all', 'Delete all notifications?', [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Clear',  onPress: () => resolve(true),  style: 'destructive' },
          ])
        );
    if (!confirm) return;
    await deleteAllNotifications(user.uid);
    setNotifications([]);
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchNotifications();
  }

  // ── Format timestamp ──────────────────────────────────────
  function timeAgo(ts) {
    if (!ts) return '';
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, styles.clearBtnText]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Category tabs ── */}
      <FlatList
        data={CATEGORIES}
        keyExtractor={item => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={{ flexGrow: 0, height: 52 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, activeCategory === item.id && styles.tabActive]}
            onPress={() => setActiveCategory(item.id)}
          >
            <Text style={[styles.tabText, activeCategory === item.id && styles.tabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Notifications list ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#1D9E75"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.read && styles.itemUnread]}
              onPress={() => handleTap(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Text style={styles.iconEmoji}>
                  {TYPE_EMOJI[item.type] ?? '🔔'}
                </Text>
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemTitleRow}>
                  <Text
                    style={[styles.itemTitle, !item.read && styles.itemTitleUnread]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySub}>
                {activeCategory
                  ? 'No notifications in this category'
                  : "You're all caught up!"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9fafb' },

  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title:           { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  unreadCount:     { fontSize: 12, color: '#1D9E75', fontWeight: '600', marginTop: 2 },
  headerActions:   { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  headerBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f0f0f0' },
  headerBtnText:   { fontSize: 12, color: '#555', fontWeight: '600' },
  clearBtnText:    { color: '#E24B4A' },

  tabs:            { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', alignSelf: 'center', height: 34, justifyContent: 'center' },
  tabActive:       { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  tabText:         { fontSize: 12, color: '#555' },
  tabTextActive:   { color: '#fff', fontWeight: '600' },

  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:            { paddingHorizontal: 16, paddingBottom: 32 },

  item:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  itemUnread:      { backgroundColor: '#F0FBF6', borderColor: '#c8eedd' },
  iconWrap:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  iconWrapUnread:  { backgroundColor: '#E1F5EE' },
  iconEmoji:       { fontSize: 20 },
  itemContent:     { flex: 1 },
  itemTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  itemTitle:       { fontSize: 14, fontWeight: '600', color: '#555', flex: 1 },
  itemTitleUnread: { color: '#1a1a1a', fontWeight: '700' },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D9E75' },
  itemBody:        { fontSize: 12, color: '#888', lineHeight: 18 },
  itemTime:        { fontSize: 11, color: '#aaa', marginTop: 4 },
  deleteBtn:       { padding: 6 },
  deleteBtnText:   { fontSize: 14, color: '#ccc' },

  emptyWrap:       { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji:      { fontSize: 48 },
  emptyTitle:      { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:        { fontSize: 13, color: '#aaa', textAlign: 'center' },
});
