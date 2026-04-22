import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
  RefreshControl, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeToUserPrivateChats,
  markPrivateChatAsRead,
  subscribeToUserGroupChats,
  markGroupChatAsRead,
  createGroupChat,
  getEligibleGroupMembers,
} from '../../services/chatService';
import { getUserById } from '../../services/userService';

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const [activeTab,      setActiveTab]      = useState('all');
  const [privateChats,   setPrivateChats]   = useState([]);
  const [groupChats,     setGroupChats]     = useState([]);
  const [enriched,       setEnriched]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  // Group creation modal
  const [showModal,      setShowModal]      = useState(false);
  const [eligible,       setEligible]       = useState([]);
  const [selected,       setSelected]       = useState([]);
  const [groupName,      setGroupName]      = useState('');
  const [creating,       setCreating]       = useState(false);
  const [loadingPeople,  setLoadingPeople]  = useState(false);

  // ── Subscribe to private chats ──
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserPrivateChats(user.uid, (rawChats) => {
      setPrivateChats(rawChats);
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, [user]);

  // ── Subscribe to group chats ──
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserGroupChats(user.uid, (rawGroups) => {
      setGroupChats(rawGroups);
    });
    return unsub;
  }, [user]);

  // ── Enrich private chats with other user's profile ──
  useEffect(() => {
    if (!user || privateChats.length === 0) {
      setEnriched([]);
      return;
    }
    async function enrich() {
      const result = await Promise.all(
        privateChats.map(async (chat) => {
          const otherId = chat.participants.find(id => id !== user.uid);
          let otherProfile = null;
          try { otherProfile = await getUserById(otherId); } catch {}
          const unread = chat.unreadCount?.[user.uid] ?? 0;
          return { ...chat, otherProfile, otherId, unread, isGroup: false };
        })
      );
      setEnriched(result);
    }
    enrich();
  }, [privateChats, user]);

  useFocusEffect(useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []));

  // ── Open group creation modal ──
  async function handleOpenModal() {
    setShowModal(true);
    setSelected([]);
    setGroupName('');
    setLoadingPeople(true);
    try {
      const people = await getEligibleGroupMembers(user.uid);
      setEligible(people);
    } catch (e) {
      console.error('getEligibleGroupMembers error:', e);
    } finally {
      setLoadingPeople(false);
    }
  }

  function toggleSelect(person) {
    setSelected(prev =>
      prev.find(p => p.id === person.id)
        ? prev.filter(p => p.id !== person.id)
        : [...prev, person]
    );
  }

  async function handleCreateGroup() {
    if (selected.length < 2) {
      if (Platform.OS === 'web') window.alert('Select at least 2 people to create a group.');
      else Alert.alert('Not enough', 'Select at least 2 people to create a group.');
      return;
    }
    if (!groupName.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a group name.');
      else Alert.alert('Missing name', 'Please enter a group name.');
      return;
    }
    setCreating(true);
    try {
      console.log('✅ Creating group:', groupName, 'members:', selected.map(p => p.id));
      const memberIds = selected.map(p => p.id);
      const groupId   = await createGroupChat(user.uid, memberIds, groupName.trim());
      console.log('✅ Group created:', groupId);
      setShowModal(false);
      navigation.navigate('GroupChat', { groupId, groupName: groupName.trim() });
    } catch (e) {
      console.error('❌ Create group error:', e);
      if (Platform.OS === 'web') window.alert('Error: ' + e.message);
      else Alert.alert('Error', e.message);
    } finally {
      setCreating(false);
    }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  async function openPrivateChat(chat) {
    if (chat.unread > 0) await markPrivateChatAsRead(chat.id, user.uid);
    navigation.navigate('PrivateChat', {
      targetUser: {
        id:            chat.otherId,
        name:          chat.otherProfile?.name ?? 'User',
        profilePicUrl: chat.otherProfile?.profilePicUrl ?? '',
      },
    });
  }

  async function openGroupChat(chat) {
    const unread = chat.unreadCount?.[user.uid] ?? 0;
    if (unread > 0) await markGroupChatAsRead(chat.id, user.uid);
    navigation.navigate('GroupChat', { groupId: chat.id, groupName: chat.name });
  }

  // ── Filtered data ──
  const allItems = [
    ...enriched,
    ...groupChats.map(g => ({ ...g, isGroup: true, unread: g.unreadCount?.[user.uid] ?? 0 })),
  ].sort((a, b) => {
    const aMs = a.lastMessageAt?.toMillis?.() ?? 0;
    const bMs = b.lastMessageAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  const filtered =
    activeTab === 'unread' ? allItems.filter(c => c.unread > 0) :
    activeTab === 'groups' ? allItems.filter(c => c.isGroup) :
    allItems;

  const totalUnread = allItems.reduce((sum, c) => sum + (c.unread ?? 0), 0);

  const renderItem = ({ item }) => {
    if (item.isGroup) return renderGroupChat(item);
    return renderPrivateChat(item);
  };

  const renderPrivateChat = (item) => {
    const isUnread = item.unread > 0;
    const name     = item.otherProfile?.name ?? 'User';
    const photo    = item.otherProfile?.profilePicUrl;
    const preview  = item.lastMessage ?? 'No messages yet';
    return (
      <TouchableOpacity style={styles.chatRow} onPress={() => openPrivateChat(item)} activeOpacity={0.7}>
        <View style={styles.avatarWrap}>
          {photo
            ? <Image source={{ uri: photo }} style={styles.avatar} />
            : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text></View>
          }
          {isUnread && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatTop}>
            <Text style={[styles.chatName, isUnread && styles.chatNameBold]}>{name}</Text>
            <Text style={[styles.chatTime, isUnread && styles.chatTimeBold]}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={[styles.chatPreview, isUnread && styles.chatPreviewBold]} numberOfLines={1}>{preview}</Text>
            {isUnread && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{item.unread}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupChat = (item) => {
    const isUnread    = item.unread > 0;
    const memberCount = item.members?.length ?? 0;
    const preview     = item.lastMessage ?? 'No messages yet';
    return (
      <TouchableOpacity style={styles.chatRow} onPress={() => openGroupChat(item)} activeOpacity={0.7}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarFallback, styles.groupAvatar]}>
            <Text style={styles.groupAvatarText}>👥</Text>
          </View>
          {isUnread && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatTop}>
            <Text style={[styles.chatName, isUnread && styles.chatNameBold]}>{item.name}</Text>
            <Text style={[styles.chatTime, isUnread && styles.chatTimeBold]}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={[styles.chatPreview, isUnread && styles.chatPreviewBold]} numberOfLines={1}>
              👥 {memberCount} members · {preview}
            </Text>
            {isUnread && <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{item.unread}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const tabs = [
    { key: 'all',    label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'groups', label: 'Groups' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.newGroupBtn} onPress={handleOpenModal}>
          <Text style={styles.newGroupBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.key === 'unread' && totalUnread > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{totalUnread}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1D9E75" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor="#1D9E75" />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>
                {activeTab === 'unread' ? '✅' : activeTab === 'groups' ? '👥' : '💬'}
              </Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'unread' ? 'All caught up!' :
                 activeTab === 'groups' ? 'No group chats yet' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'unread' ? 'No unread messages' :
                 activeTab === 'groups' ? 'Tap ＋ to create a group' :
                 'Start a conversation from the Social feed'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Create Group Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Group Chat</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.groupNameInput}
              placeholder="Group name..."
              placeholderTextColor="#aaa"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={40}
            />

            <Text style={styles.modalSubtitle}>
              Select at least 2 people ({selected.length} selected)
            </Text>

            {loadingPeople ? (
              <View style={styles.modalCentered}>
                <ActivityIndicator color="#1D9E75" />
              </View>
            ) : eligible.length === 0 ? (
              <View style={styles.modalCentered}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.modalEmptyText}>
                  No eligible people yet.{'\n'}Follow someone or start a private chat first.
                </Text>
              </View>
            ) : (
              <FlatList
                data={eligible}
                keyExtractor={item => item.id}
                style={styles.peopleList}
                renderItem={({ item }) => {
                  const isSelected = selected.find(p => p.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.personRow, isSelected && styles.personRowSelected]}
                      onPress={() => toggleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.personAvatar}>
                        {item.profilePicUrl
                          ? <Image source={{ uri: item.profilePicUrl }} style={styles.personAvatarImg} />
                          : <View style={styles.personAvatarFallback}>
                              <Text style={styles.personAvatarText}>{item.name?.[0]?.toUpperCase() ?? '?'}</Text>
                            </View>
                        }
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={styles.personName}>{item.name ?? 'User'}</Text>
                        <Text style={styles.personEmail} numberOfLines={1}>{item.email}</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.createBtn, (selected.length < 2 || !groupName.trim() || creating) && styles.createBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={selected.length < 2 || !groupName.trim() || creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.createBtnText}>Create Group ({selected.length + 1} members)</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f9fafb' },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 10 },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  backArrow:          { fontSize: 18, color: '#1a1a1a' },
  title:              { fontSize: 20, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  newGroupBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  newGroupBtnText:    { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },

  tabs:               { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab:                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5', gap: 6 },
  tabActive:          { backgroundColor: '#1D9E75' },
  tabText:            { fontSize: 13, fontWeight: '600', color: '#555' },
  tabTextActive:      { color: '#fff' },
  tabBadge:           { backgroundColor: '#e53935', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText:       { color: '#fff', fontSize: 10, fontWeight: '700' },

  list:               { paddingVertical: 8 },
  chatRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 14 },
  avatarWrap:         { position: 'relative' },
  avatar:             { width: 52, height: 52, borderRadius: 26 },
  avatarFallback:     { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  avatarText:         { color: '#fff', fontWeight: '700', fontSize: 20 },
  groupAvatar:        { backgroundColor: '#E1F5EE' },
  groupAvatarText:    { fontSize: 24 },
  onlineDot:          { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#1D9E75', borderWidth: 2, borderColor: '#fff' },

  chatContent:        { flex: 1 },
  chatTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName:           { fontSize: 15, color: '#1a1a1a', fontWeight: '400' },
  chatNameBold:       { fontWeight: '700' },
  chatTime:           { fontSize: 12, color: '#aaa' },
  chatTimeBold:       { color: '#1D9E75', fontWeight: '600' },
  chatBottom:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatPreview:        { fontSize: 13, color: '#aaa', flex: 1, marginRight: 8 },
  chatPreviewBold:    { color: '#555', fontWeight: '600' },
  unreadBadge:        { backgroundColor: '#1D9E75', borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  unreadBadgeText:    { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyWrap:          { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji:         { fontSize: 52 },
  emptyTitle:         { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:           { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalClose:         { fontSize: 18, color: '#aaa', padding: 4 },
  modalSubtitle:      { fontSize: 13, color: '#888', marginBottom: 10 },
  modalCentered:      { alignItems: 'center', paddingVertical: 30, gap: 10 },
  modalEmptyText:     { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20 },

  groupNameInput:     { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1a1a1a', marginBottom: 14 },

  peopleList:         { maxHeight: 320, marginBottom: 16 },
  personRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  personRowSelected:  { backgroundColor: '#F0FBF6', borderRadius: 10, paddingHorizontal: 8 },
  personAvatar:       { width: 42, height: 42 },
  personAvatarImg:    { width: 42, height: 42, borderRadius: 21 },
  personAvatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  personAvatarText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  personInfo:         { flex: 1 },
  personName:         { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  personEmail:        { fontSize: 12, color: '#aaa', marginTop: 2 },
  checkbox:           { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected:   { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  checkmark:          { color: '#fff', fontSize: 13, fontWeight: '700' },

  createBtn:          { backgroundColor: '#1D9E75', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnDisabled:  { backgroundColor: '#a0d4c0' },
  createBtnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
