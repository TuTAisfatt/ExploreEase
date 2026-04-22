import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { sendMessage, subscribeToMessages } from '../../services/chatService';

export default function ChatScreen({ navigation }) {
  const { user, userProfile } = useAuth();

  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const flatRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToMessages(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Auto scroll to bottom ─────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage({
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

  // ── Send a recommendation ─────────────────────────────────
  async function sendRecommendation(place) {
    if (!user) return;
    try {
      await sendMessage({
        text:      `📍 I recommend: ${place.name}\n${place.address ?? ''}`,
        userId:    user.uid,
        userName:  userProfile?.name ?? 'Anonymous',
        userPhoto: userProfile?.profilePicUrl ?? '',
        type:      'recommendation',
        placeId:   place.id,
        placeName: place.name,
      });
    } catch (e) {
      console.error('sendRecommendation error:', e);
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

  const renderMessage = ({ item, index }) => {
    const isMe      = item.userId === user?.uid;
    const showName  = !isMe && (index === 0 || messages[index - 1]?.userId !== item.userId);
    const isRecommendation = item.type === 'recommendation';

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {/* Avatar for others */}
        {!isMe && showName && (
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
        {!isMe && !showName && <View style={styles.msgAvatarSpacer} />}

        <View style={styles.msgContent}>
          {showName && !isMe && (
            <Text style={styles.msgSenderName}>{item.userName}</Text>
          )}
          <View style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
            isRecommendation && styles.bubbleRecommendation,
          ]}>
            {isRecommendation && (
              <Text style={styles.recommendationLabel}>📍 Recommendation</Text>
            )}
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
              {item.text}
            </Text>
            {isRecommendation && item.placeId && (
              <TouchableOpacity
                style={styles.viewPlaceBtn}
                onPress={() => navigation.navigate('Discover', {
                  screen: 'Detail',
                  params: { itemId: item.placeId, type: 'attraction' },
                })}
              >
                <Text style={styles.viewPlaceBtnText}>View Place →</Text>
              </TouchableOpacity>
            )}
          </View>
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
        <Text style={styles.headerTitle}>💬 Community Chat</Text>
        <Text style={styles.headerSub}>Share recommendations with everyone</Text>
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
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>Be the first to say something!</Text>
              </View>
            }
          />
        )}

        {/* ── Input row ── */}
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
  container:            { flex: 1, backgroundColor: '#f9fafb' },
  flex:                 { flex: 1 },
  centered:             { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:               { backgroundColor: '#1D9E75', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle:          { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:            { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  list:                 { paddingHorizontal: 16, paddingVertical: 12 },

  msgRow:               { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  msgRowMe:             { flexDirection: 'row-reverse' },
  msgAvatar:            { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  msgAvatarImg:         { width: 32, height: 32, borderRadius: 16 },
  msgAvatarText:        { color: '#fff', fontWeight: '700', fontSize: 13 },
  msgAvatarSpacer:      { width: 32 },
  msgContent:           { maxWidth: '75%' },
  msgSenderName:        { fontSize: 11, color: '#888', marginBottom: 3, marginLeft: 4 },

  bubble:               { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:             { backgroundColor: '#1D9E75', borderBottomRightRadius: 4 },
  bubbleOther:          { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  bubbleRecommendation: { borderWidth: 1, borderColor: '#1D9E75' },

  recommendationLabel:  { fontSize: 11, fontWeight: '700', color: '#1D9E75', marginBottom: 4 },
  msgText:              { fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  msgTextMe:            { color: '#fff' },
  msgTime:              { fontSize: 10, color: '#aaa', marginTop: 3, marginLeft: 4 },
  msgTimeMe:            { textAlign: 'right', marginRight: 4 },

  viewPlaceBtn:         { marginTop: 8, backgroundColor: 'rgba(29,158,117,0.15)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
  viewPlaceBtnText:     { fontSize: 12, color: '#1D9E75', fontWeight: '700' },

  inputRow:             { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
  input:                { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', maxHeight: 100 },
  sendBtn:              { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D9E75', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled:      { backgroundColor: '#a0d4c0' },
  sendBtnText:          { color: '#fff', fontSize: 18, fontWeight: '700' },

  emptyWrap:            { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:           { fontSize: 48 },
  emptyTitle:           { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  emptySub:             { fontSize: 13, color: '#aaa' },
});
