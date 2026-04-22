import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  getFollowerProfiles,
  getFollowingProfiles,
  followUser,
  unfollowUser,
  isFollowing,
} from '../../services/socialService';

export default function FollowListScreen({ route, navigation }) {
  const { userId, type } = route.params;
  const { user } = useAuth();

  const [people,  setPeople]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [userId, type]);

  async function load() {
    setLoading(true);
    try {
      const raw = type === 'followers'
        ? await getFollowerProfiles(userId)
        : await getFollowingProfiles(userId);

      const withStatus = await Promise.all(
        raw.map(async p => ({
          ...p,
          isFollowed: p.id === user.uid ? null : await isFollowing(user.uid, p.id),
        }))
      );
      setPeople(withStatus);
    } catch (e) {
      console.error('FollowListScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFollow(person) {
    try {
      if (person.isFollowed) {
        await unfollowUser(user.uid, person.id);
      } else {
        await followUser(user.uid, person.id);
      }
      setPeople(prev =>
        prev.map(p =>
          p.id === person.id ? { ...p, isFollowed: !p.isFollowed } : p
        )
      );
    } catch (e) {
      console.error('toggleFollow error:', e);
    }
  }

  const renderPerson = ({ item }) => {
    const isMe = item.id === user.uid;
    return (
      <View style={styles.personRow}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PrivateChat', {
            targetUser: { id: item.id, name: item.name, profilePicUrl: item.profilePicUrl ?? '' },
          })}
        >
          {item.profilePicUrl ? (
            <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.name}>{item.name ?? 'User'}</Text>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
        </View>

        {!isMe && (
          <TouchableOpacity
            style={[styles.followBtn, item.isFollowed && styles.followBtnActive]}
            onPress={() => handleToggleFollow(item)}
          >
            <Text style={[styles.followBtnText, item.isFollowed && styles.followBtnTextActive]}>
              {item.isFollowed ? '✓ Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {type === 'followers' ? 'Followers' : 'Following'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderPerson}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>
                {type === 'followers' ? '👥' : '🔭'}
              </Text>
              <Text style={styles.emptyTitle}>
                {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </Text>
              <Text style={styles.emptySub}>
                {type === 'followers'
                  ? 'Share your profile to get followers!'
                  : 'Find people to follow in the Social tab.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#f9fafb' },
  centered:            { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  backBtn:             { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  backArrow:           { fontSize: 18, color: '#1a1a1a' },
  title:               { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },

  list:                { paddingVertical: 8, paddingHorizontal: 20 },
  personRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 12 },
  avatar:              { width: 48, height: 48, borderRadius: 24 },
  avatarFallback:      { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  avatarText:          { color: '#fff', fontWeight: '700', fontSize: 18 },
  info:                { flex: 1 },
  name:                { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  email:               { fontSize: 12, color: '#aaa', marginTop: 2 },
  followBtn:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1D9E75' },
  followBtnActive:     { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  followBtnText:       { fontSize: 12, color: '#fff', fontWeight: '700' },
  followBtnTextActive: { color: '#555' },

  emptyWrap:           { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji:          { fontSize: 52 },
  emptyTitle:          { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:            { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },
});
