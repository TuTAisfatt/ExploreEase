import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import {
  getOrCreateEventChat, sendEventMessage,
  subscribeToEventMessages, getEventChat,
  pinEventMessage, unpinEventMessage,
} from '../../services/chatService';

export default function EventChatScreen({ route, navigation }) {
  const { eventId, eventTitle } = route.params;
  const { user, userProfile, isAdmin } = useAuth();

  const [messages,       setMessages]       = useState([]);
  const [text,           setText]           = useState('');
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [pinnedMessage,  setPinnedMessage]  = useState(null);
  const [pinnedMsgId,    setPinnedMsgId]    = useState(null);
  const [chatInfo,       setChatInfo]       = useState(null);
  const flatRef = useRef(null);

  useEffect(() => {
    setupChat();
  }, []);

  async function setupChat() {
    try {
      await getOrCreateEventChat(eventId, eventTitle);
      const info = await getEventChat(eventId);
      setChatInfo(info);
      setPinnedMessage(info?.pinnedMessage ?? null);
      setPinnedMsgId(info?.pinnedMessageId ?? null);

      const unsub = subscribeToEventMessages(eventId, msgs => {
        setMessages(msgs);
        setLoading(false);
      });
      return unsub;
    } catch (e) {
      console.error('setupChat error:', e);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!text.trim()) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendEventMessage(eventId, {
        text:      msg,
        userId:    user.uid,
        userName:  userProfile?.name ?? 'Anonymous',
        userPhoto: userProfile?.profilePicUrl ?? '',
        type:      'text',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not send message.');
      setText(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleSendImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType?.Images ?? 'Images',
      allowsEditing: true,
      quality: 0.7,
      base64: Platform.OS !== 'web',
    });
    if (!result.canceled) {
      try {
        setSending(true);
        const asset    = result.assets[0];
        const mime     = asset.mimeType ?? 'image/jpeg';
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob     = await response.blob();
          formData.append('file', blob);
        } else {
          formData.append('file', `data:${mime};base64,${asset.base64}`);
        }
        formData.append('upload_preset', 'exploreease_reviews');
        const res  = await fetch(
          'https://api.cloudinary.com/v1_1/dpmtwyqg6/image/upload',
          { method: 'POST', body: formData }
        );
        const data = await res.json();
        if (data.secure_url) {
          await sendEventMessage(eventId, {
            text:      '📷 Image',
            imageUrl:  data.secure_url,
            userId:    user.uid,
            userName:  userProfile?.name ?? 'Anonymous',
            userPhoto: userProfile?.profilePicUrl ?? '',
            type:      'image',
          });
        }
      } catch (e) {
        Alert.alert('Error', 'Could not send image.');
      } finally {
        setSending(false);
      }
    }
  }

  async function handleSendLocation() {
    try {
      const { getCurrentLocation } = await import('../../services/locationService');
      const result = await getCurrentLocation();
      await sendEventMessage(eventId, {
        text:     `📍 Location shared: ${result.region.latitude.toFixed(4)}, ${result.region.longitude.toFixed(4)}`,
        location: { latitude: result.region.latitude, longitude: result.region.longitude },
        userId:   user.uid,
        userName: userProfile?.name ?? 'Anonymous',
        type:     'location',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not send location.');
    }
  }

  async function handlePinMessage(msg) {
    try {
      if (pinnedMsgId === msg.id) {
        await unpinEventMessage(eventId, msg.id);
        setPinnedMessage(null);
        setPinnedMsgId(null);
      } else {
        await pinEventMessage(eventId, msg.id, msg.text);
        setPinnedMessage(msg.text);
        setPinnedMsgId(msg.id);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pin message.');
    }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff  = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const renderMessage = ({ item }) => {
    const isMe     = item.userId === user?.uid;
    const canPin   = isAdmin;
    const isPinned = item.id === pinnedMsgId;

    return (
      <TouchableOpacity
        activeOpacity={canPin ? 0.7 : 1}
        onLongPress={() => canPin && handlePinMessage(item)}
      >
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={styles.msgAvatar}>
              {item.userPhoto ? (
                <Image source={{ uri: item.userPhoto }} style={styles.msgAvatarImg} />
              ) : (
                <Text style={styles.msgAvatarText}>
                  {item.userName?.[0]?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>
          )}
          <View style={styles.msgContent}>
            {!isMe && (
              <Text style={styles.msgSenderName}>{item.userName}</Text>
            )}
            <View style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              isPinned && styles.bubblePinned,
            ]}>
              {isPinned && (
                <Text style={styles.pinnedLabel}>📌 Pinned</Text>
              )}
              {item.type === 'image' && item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.msgImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                  {item.text}
                </Text>
              )}
              <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle}</Text>
          <Text style={styles.headerSub}>Event Group Chat · {messages.length} messages</Text>
        </View>
      </View>

      {/* ── Pinned message ── */}
      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedBannerIcon}>📌</Text>
          <Text style={styles.pinnedBannerText} numberOfLines={1}>
            {pinnedMessage}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1D9E75" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={renderMessage}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptySub}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />
        )}

        {/* ── Input row ── */}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={handleSendImage}>
            <Text style={styles.attachBtnText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={handleSendLocation}>
            <Text style={styles.attachBtnText}>📍</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#aaa"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb' },
  flex:             { flex: 1 },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1D9E75', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, gap: 12 },
  backBtn:          { padding: 4 },
  backText:         { fontSize: 22, color: '#fff' },
  headerInfo:       { flex: 1 },
  headerTitle:      { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:        { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  pinnedBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  pinnedBannerIcon: { fontSize: 16 },
  pinnedBannerText: { flex: 1, fontSize: 13, color: '#633806', fontWeight: '500' },

  list:             { paddingHorizontal: 16, paddingVertical: 12 },
  msgRow:           { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  msgRowMe:         { flexDirection: 'row-reverse' },
  msgAvatar:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  msgAvatarImg:     { width: 32, height: 32, borderRadius: 16 },
  msgAvatarText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  msgContent:       { maxWidth: '75%' },
  msgSenderName:    { fontSize: 11, color: '#888', marginBottom: 3, marginLeft: 4 },

  bubble:           { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:         { backgroundColor: '#1D9E75', borderBottomRightRadius: 4 },
  bubbleOther:      { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  bubblePinned:     { borderWidth: 2, borderColor: '#F18F01' },
  pinnedLabel:      { fontSize: 10, color: '#F18F01', fontWeight: '700', marginBottom: 4 },
  msgText:          { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  msgTextMe:        { color: '#fff' },
  msgTime:          { fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 4 },
  msgTimeMe:        { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgImage:         { width: 200, height: 150, borderRadius: 10 },

  inputRow:         { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
  attachBtn:        { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  attachBtnText:    { fontSize: 20 },
  input:            { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:  { backgroundColor: '#a0d4c0' },
  sendBtnText:      { color: '#fff', fontSize: 18, fontWeight: '700' },

  emptyWrap:        { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:       { fontSize: 48 },
  emptySub:         { fontSize: 13, color: '#aaa', textAlign: 'center', paddingHorizontal: 40 },
});
