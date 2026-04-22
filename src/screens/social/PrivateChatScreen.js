import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import {
  getOrCreatePrivateChat,
  sendPrivateMessage,
  sendPrivateMessageWithUnread,
  subscribeToPrivateMessages,
  markPrivateChatAsRead,
} from '../../services/chatService';

export default function PrivateChatScreen({ route, navigation }) {
  const { targetUser } = route.params;
  const { user, userProfile } = useAuth();

  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [chatId,    setChatId]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const flatRef = useRef(null);

  useEffect(() => {
    setupChat();
  }, []);

  async function setupChat() {
    try {
      const id = await getOrCreatePrivateChat(user.uid, targetUser.id);
      setChatId(id);
      await markPrivateChatAsRead(id, user.uid);
      const unsub = subscribeToPrivateMessages(id, msgs => {
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
    if (!text.trim() || !chatId) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendPrivateMessageWithUnread(chatId, {
        text:      msg,
        userId:    user.uid,
        userName:  userProfile?.name ?? 'Anonymous',
        userPhoto: userProfile?.profilePicUrl ?? '',
        type:      'text',
      }, targetUser.id);
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
          await sendPrivateMessageWithUnread(chatId, {
            text:      '📷 Image',
            imageUrl:  data.secure_url,
            userId:    user.uid,
            userName:  userProfile?.name ?? 'Anonymous',
            userPhoto: userProfile?.profilePicUrl ?? '',
            type:      'image',
          }, targetUser.id);
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
      const { region } = await getCurrentLocation();
      await sendPrivateMessage(chatId, {
        text:      `📍 Location: ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`,
        location:  { latitude: region.latitude, longitude: region.longitude },
        userId:    user.uid,
        userName:  userProfile?.name ?? 'Anonymous',
        userPhoto: userProfile?.profilePicUrl ?? '',
        type:      'location',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not send location.');
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
    const isMe = item.userId === user?.uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
        ]}>
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
          <View style={styles.headerAvatar}>
            {targetUser.profilePicUrl ? (
              <Image source={{ uri: targetUser.profilePicUrl }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarText}>
                {targetUser.name?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.headerName}>{targetUser.name ?? 'User'}</Text>
            <Text style={styles.headerSub}>🔒 End-to-end encrypted</Text>
          </View>
        </View>
      </View>

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
                  Start a conversation with {targetUser.name}!
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
  headerInfo:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  headerAvatarImg:  { width: 38, height: 38, borderRadius: 19 },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerName:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:        { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  list:             { paddingHorizontal: 16, paddingVertical: 12 },
  msgRow:           { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMe:         { alignItems: 'flex-end' },
  bubble:           { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:         { backgroundColor: '#1D9E75', borderBottomRightRadius: 4 },
  bubbleOther:      { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
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
