import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  sendGroupMessage,
  subscribeToGroupMessages,
  markGroupChatAsRead,
} from '../../services/chatService';

export default function GroupChatScreen({ route, navigation }) {
  const { groupId, groupName } = route.params;
  const { user, userProfile }  = useAuth();

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const flatRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToGroupMessages(groupId, msgs => {
      setMessages(msgs);
      setLoading(false);
    });
    markGroupChatAsRead(groupId, user.uid).catch(() => {});
    return unsub;
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !groupId) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendGroupMessage(groupId, {
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

  function timeAgo(ts) {
    if (!ts) return '';
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const renderMessage = ({ item, index }) => {
    const isMe     = item.userId === user?.uid;
    const showName = !isMe && (index === 0 || messages[index - 1]?.userId !== item.userId);

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && showName && (
          <View style={styles.msgAvatar}>
            {item.userPhoto
              ? <Image source={{ uri: item.userPhoto }} style={styles.msgAvatarImg} />
              : <Text style={styles.msgAvatarText}>{item.userName?.[0]?.toUpperCase() ?? '?'}</Text>
            }
          </View>
        )}
        {!isMe && !showName && <View style={styles.msgAvatarSpacer} />}

        <View style={styles.msgContent}>
          {showName && !isMe && (
            <Text style={styles.msgSenderName}>{item.userName}</Text>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
            <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarEmoji}>👥</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{groupName}</Text>
            <Text style={styles.headerSub}>Group chat</Text>
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
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyTitle}>Group created!</Text>
                <Text style={styles.emptySub}>Be the first to say something.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputRow}>
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
  container:         { flex: 1, backgroundColor: '#f9fafb' },
  flex:              { flex: 1 },
  centered:          { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1D9E75', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, gap: 12 },
  backBtn:           { padding: 4 },
  backText:          { fontSize: 22, color: '#fff' },
  headerInfo:        { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  headerAvatarEmoji: { fontSize: 20 },
  headerName:        { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub:         { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  list:              { paddingHorizontal: 16, paddingVertical: 12 },
  msgRow:            { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  msgRowMe:          { flexDirection: 'row-reverse' },
  msgAvatar:         { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  msgAvatarImg:      { width: 32, height: 32, borderRadius: 16 },
  msgAvatarText:     { color: '#fff', fontWeight: '700', fontSize: 13 },
  msgAvatarSpacer:   { width: 32 },
  msgContent:        { maxWidth: '75%' },
  msgSenderName:     { fontSize: 11, color: '#888', marginBottom: 3, marginLeft: 4 },

  bubble:            { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:          { backgroundColor: '#1D9E75', borderBottomRightRadius: 4 },
  bubbleOther:       { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  msgText:           { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  msgTextMe:         { color: '#fff' },
  msgTime:           { fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 4 },
  msgTimeMe:         { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },

  inputRow:          { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
  input:             { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:   { backgroundColor: '#a0d4c0' },
  sendBtnText:       { color: '#fff', fontSize: 18, fontWeight: '700' },

  emptyWrap:         { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:        { fontSize: 48 },
  emptyTitle:        { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:          { fontSize: 13, color: '#aaa' },
});
