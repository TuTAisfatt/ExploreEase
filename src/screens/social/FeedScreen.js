import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput,
  RefreshControl, Image, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  searchUsers, followUser, unfollowUser,
  isFollowing, getFollowing, getActivityFeed, getGlobalActivity,
} from '../../services/socialService';
import { subscribeToUserPrivateChats } from '../../services/chatService';

const ACTIVITY_EMOJI = {
  rated:       '⭐',
  joined:      '🎉',
  bookmarked:  '🔖',
  reviewed:    '✍️',
};

const ACTIVITY_TEXT = {
  rated:       'rated',
  joined:      'joined',
  bookmarked:  'bookmarked',
  reviewed:    'reviewed',
};

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();

  const [activeTab,      setActiveTab]      = useState('feed');
  const [feed,           setFeed]           = useState([]);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [followingIds,   setFollowingIds]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [searching,      setSearching]      = useState(false);
  const [unreadMsgs,     setUnreadMsgs]     = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserPrivateChats(user.uid, chats => {
      const count = chats.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] ?? 0), 0);
      setUnreadMsgs(count);
    });
    return unsub;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [user])
  );

  async function fetchFeed() {
    if (!user) return;
    try {
      const following = await getFollowing(user.uid);
      setFollowingIds(following);
      let activities;
      if (following.length > 0) {
        activities = await getActivityFeed(following);
      } else {
        activities = await getGlobalActivity();
      }
      setFeed(activities);
    } catch (e) {
      console.error('fetchFeed error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchFeed();
  }

  // ── Search users ──────────────────────────────────────────
  async function handleSearch(text) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results  = await searchUsers(text.trim());
      const filtered = results.filter(u => u.id !== user.uid);
      // Add following status
      const withStatus = await Promise.all(
        filtered.map(async u => ({
          ...u,
          isFollowed: await isFollowing(user.uid, u.id),
        }))
      );
      setSearchResults(withStatus);
    } catch (e) {
      console.error('searchUsers error:', e);
    } finally {
      setSearching(false);
    }
  }

  // ── Follow / Unfollow ─────────────────────────────────────
  async function handleFollowToggle(targetUser) {
    try {
      if (targetUser.isFollowed) {
        await unfollowUser(user.uid, targetUser.id);
        setFollowingIds(prev => prev.filter(id => id !== targetUser.id));
      } else {
        await followUser(user.uid, targetUser.id);
        setFollowingIds(prev => [...prev, targetUser.id]);
      }
      setSearchResults(prev =>
        prev.map(u =>
          u.id === targetUser.id
            ? { ...u, isFollowed: !u.isFollowed }
            : u
        )
      );
    } catch (e) {
      Alert.alert('Error', 'Could not update follow status.');
    }
  }

  // ── Format time ───────────────────────────────────────────
  function timeAgo(ts) {
    if (!ts) return '';
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const renderActivity = ({ item }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityAvatar}>
        <Text style={styles.activityAvatarText}>
          {item.userName?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>
          <Text style={styles.activityName}>{item.userName}</Text>
          {' '}{ACTIVITY_TEXT[item.type] ?? 'visited'}{' '}
          <Text style={styles.activityTarget}>{item.targetName}</Text>
          {' '}{ACTIVITY_EMOJI[item.type] ?? '📍'}
        </Text>
        <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );

  const renderUserResult = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userAvatar}>
        {item.profilePicUrl ? (
          <Image source={{ uri: item.profilePicUrl }} style={styles.userAvatarImg} />
        ) : (
          <Text style={styles.userAvatarText}>
            {item.name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name ?? 'Unknown'}</Text>
        <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, item.isFollowed && styles.followBtnActive]}
        onPress={() => handleFollowToggle(item)}
      >
        <Text style={[styles.followBtnText, item.isFollowed && styles.followBtnTextActive]}>
          {item.isFollowed ? '✓ Following' : '+ Follow'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.msgBtn}
        onPress={() => navigation.navigate('PrivateChat', { targetUser: item })}
      >
        <Text style={styles.msgBtnText}>💬</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Social</Text>
          <Text style={styles.followingCount}>Following {followingIds.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => navigation.navigate('Messages')}
        >
          <Text style={styles.chatBtnText}>💬 Messages</Text>
          {unreadMsgs > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
            🏠 Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            🔍 Find People
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Feed tab ── */}
      {activeTab === 'feed' && (
        loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1D9E75" />
          </View>
        ) : (
          <FlatList
            data={feed}
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
            renderItem={renderActivity}
            ListHeaderComponent={
              followingIds.length === 0 ? (
                <View style={styles.noFollowingBanner}>
                  <Text style={styles.noFollowingText}>
                    👋 Follow people to see their activity! Showing global feed for now.
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptySub}>
                  Follow people to see what they're up to!
                </Text>
              </View>
            }
          />
        )
      )}

      {/* ── Discover tab ── */}
      {activeTab === 'discover' && (
        <View style={styles.discoverWrap}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color="#1D9E75" />}
          </View>

          {searchQuery.length < 2 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptySub}>Type at least 2 characters to search</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={renderUserResult}
              ListEmptyComponent={
                !searching ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>No users found</Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#f9fafb' },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 60 },

  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title:               { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  followingCount:      { fontSize: 13, color: '#888' },

  tabs:                { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  tab:                 { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  tabActive:           { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  tabText:             { fontSize: 13, color: '#555', fontWeight: '500' },
  tabTextActive:       { color: '#fff', fontWeight: '700' },

  list:                { paddingHorizontal: 20, paddingBottom: 32 },

  noFollowingBanner:   { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 12 },
  noFollowingText:     { fontSize: 13, color: '#633806', lineHeight: 18 },

  activityCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  activityAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  activityAvatarText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  activityContent:     { flex: 1 },
  activityText:        { fontSize: 14, color: '#555', lineHeight: 20 },
  activityName:        { fontWeight: '700', color: '#1a1a1a' },
  activityTarget:      { fontWeight: '600', color: '#1D9E75' },
  activityTime:        { fontSize: 11, color: '#aaa', marginTop: 4 },

  discoverWrap:        { flex: 1 },
  searchBar:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 12, gap: 8 },
  searchIcon:          { fontSize: 15 },
  searchInput:         { flex: 1, fontSize: 14, color: '#1a1a1a' },

  userCard:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0', gap: 12 },
  userAvatar:          { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  userAvatarImg:       { width: 44, height: 44, borderRadius: 22 },
  userAvatarText:      { color: '#fff', fontWeight: '700', fontSize: 18 },
  userInfo:            { flex: 1 },
  userName:            { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  userEmail:           { fontSize: 12, color: '#888', marginTop: 2 },
  followBtn:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1D9E75' },
  followBtnActive:     { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  followBtnText:       { fontSize: 12, color: '#fff', fontWeight: '700' },
  followBtnTextActive: { color: '#555' },
  msgBtn:              { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  msgBtnText:          { fontSize: 16 },

  emptyWrap:           { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:          { fontSize: 48 },
  emptyTitle:          { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:            { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  chatBtn:       { backgroundColor: '#1D9E75', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  chatBadge:     { backgroundColor: '#e53935', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  chatBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
