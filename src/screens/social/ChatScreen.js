import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { sendMessage, subscribeToMessages } from '../../services/chatService';
import { COLORS, SIZES, SPACING } from '../../utils/constants';
import useAuth from '../../hooks/useAuth';

const ChatScreen = () => {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToMessages((msgs) => {
      setMessages(msgs);
    });
    return unsub;
  }, []);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text.trim();
    setText('');
    await sendMessage({
      text: msg,
      userId: user.uid,
      userName: userProfile?.displayName ?? 'Anonymous',
      userPhoto: userProfile?.photoURL ?? '',
    });
  };

  const renderMessage = ({ item }) => {
    const isMe = item.userId === user?.uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.senderName}>{item.userName}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Chat</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <MaterialIcons name="send" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: SIZES.large, fontWeight: '700', color: COLORS.white },
  list: { padding: SPACING.sm },
  msgRow: { marginBottom: SPACING.sm, alignItems: 'flex-start' },
  msgRowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    elevation: 1,
  },
  bubbleMe: { backgroundColor: COLORS.primary },
  bubbleOther: {},
  senderName: { fontSize: SIZES.xsmall, color: COLORS.primary, fontWeight: '600', marginBottom: 2 },
  msgText: { fontSize: SIZES.medium, color: COLORS.text },
  msgTextMe: { color: COLORS.white },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderColor: COLORS.lightGray,
  },
  input: {
    flex: 1,
    fontSize: SIZES.medium,
    maxHeight: 100,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 20,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 8,
    marginLeft: SPACING.sm,
  },
});

export default ChatScreen;
