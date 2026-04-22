import {
  collection, addDoc, getDocs, getDoc, updateDoc,
  doc, query, orderBy, limit, onSnapshot,
  serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─────────────────────────────────────────────
// 1. COMMUNITY CHAT (existing — unchanged)
// ─────────────────────────────────────────────
export const sendMessage = async (data) => {
  await addDoc(collection(db, 'messages'), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToMessages = (callback, pageLimit = 50) => {
  const q = query(
    collection(db, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(pageLimit)
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
};

// ─────────────────────────────────────────────
// 2. PRIVATE CHAT
// ─────────────────────────────────────────────

// Get or create a private chat room between two users
export async function getOrCreatePrivateChat(userId1, userId2) {
  // Chat ID is always sorted so it's consistent
  const chatId = [userId1, userId2].sort().join('_');
  const ref    = doc(db, 'privateChats', chatId);
  const snap   = await getDoc(ref);

  if (!snap.exists()) {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, {
      participants:  [userId1, userId2],
      createdAt:     serverTimestamp(),
      lastMessage:   null,
      lastMessageAt: null,
    });
  }
  return chatId;
}

// Send a private message
export async function sendPrivateMessage(chatId, data) {
  // Simple XOR encryption for message text
  const encryptedText = encryptMessage(data.text ?? '');
  await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
    ...data,
    text:      encryptedText,
    createdAt: serverTimestamp(),
  });
  // Update last message
  await updateDoc(doc(db, 'privateChats', chatId), {
    lastMessage:   data.text?.slice(0, 50) ?? '',
    lastMessageAt: serverTimestamp(),
  });
}

// Subscribe to private messages
export function subscribeToPrivateMessages(chatId, callback) {
  const q = query(
    collection(db, 'privateChats', chatId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      // Decrypt message text
      if (data.text) data.text = decryptMessage(data.text);
      return data;
    });
    callback(msgs);
  });
}

// Get all private chats for a user
export async function getUserPrivateChats(userId) {
  const q    = query(
    collection(db, 'privateChats'),
    where('participants', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// 3. EVENT GROUP CHAT
// ─────────────────────────────────────────────

// Get or create event group chat
export async function getOrCreateEventChat(eventId, eventTitle) {
  const ref  = doc(db, 'eventChats', eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, {
      eventId,
      eventTitle,
      createdAt:       serverTimestamp(),
      pinnedMessage:   null,
      pinnedMessageId: null,
    });
  }
  return eventId;
}

// Send event group message
export async function sendEventMessage(eventId, data) {
  await addDoc(collection(db, 'eventChats', eventId, 'messages'), {
    ...data,
    pinned:    false,
    createdAt: serverTimestamp(),
  });
}

// Subscribe to event group messages
export function subscribeToEventMessages(eventId, callback) {
  const q = query(
    collection(db, 'eventChats', eventId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

// Pin a message in event chat
export async function pinEventMessage(eventId, messageId, messageText) {
  await updateDoc(doc(db, 'eventChats', eventId), {
    pinnedMessage:   messageText,
    pinnedMessageId: messageId,
  });
  await updateDoc(doc(db, 'eventChats', eventId, 'messages', messageId), {
    pinned: true,
  });
}

// Unpin message
export async function unpinEventMessage(eventId, messageId) {
  await updateDoc(doc(db, 'eventChats', eventId), {
    pinnedMessage:   null,
    pinnedMessageId: null,
  });
  await updateDoc(doc(db, 'eventChats', eventId, 'messages', messageId), {
    pinned: false,
  });
}

// Get event chat info (including pinned message)
export async function getEventChat(eventId) {
  const snap = await getDoc(doc(db, 'eventChats', eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ─────────────────────────────────────────────
// 4. UNREAD MESSAGE HELPERS
// ─────────────────────────────────────────────

export function subscribeToUserPrivateChats(userId, callback) {
  const q = query(
    collection(db, 'privateChats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, snap => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  });
}

export async function getUnreadPrivateChatCount(userId) {
  const q    = query(
    collection(db, 'privateChats'),
    where('participants', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  let count  = 0;
  snap.docs.forEach(d => {
    const unreadMap = d.data().unreadCount ?? {};
    count += unreadMap[userId] ?? 0;
  });
  return count;
}

export async function markPrivateChatAsRead(chatId, userId) {
  await updateDoc(doc(db, 'privateChats', chatId), {
    [`unreadCount.${userId}`]: 0,
  });
}

export async function sendPrivateMessageWithUnread(chatId, data, recipientId) {
  const encryptedText = encryptMessage(data.text ?? '');
  await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
    ...data,
    text:      encryptedText,
    createdAt: serverTimestamp(),
  });
  const chatSnap = await getDoc(doc(db, 'privateChats', chatId));
  const current  = chatSnap.data()?.unreadCount?.[recipientId] ?? 0;
  await updateDoc(doc(db, 'privateChats', chatId), {
    lastMessage:                    data.text?.slice(0, 50) ?? '',
    lastMessageAt:                  serverTimestamp(),
    [`unreadCount.${recipientId}`]: current + 1,
  });

  const { createNotification } = await import('./notificationService');
  await createNotification(recipientId, {
    title: `💬 New message from ${data.userName ?? 'Someone'}`,
    body:  data.type === 'image'    ? '📷 Sent you an image' :
           data.type === 'location' ? '📍 Sent you a location' :
           data.text?.slice(0, 60) ?? '',
    type:  'message',
    data:  { chatId, senderId: data.userId },
  });
}

// ─────────────────────────────────────────────
// 5. GROUP CHAT
// ─────────────────────────────────────────────

export async function createGroupChat(creatorId, memberIds, groupName) {
  const allMembers = [...new Set([creatorId, ...memberIds])];
  const { setDoc } = await import('firebase/firestore');
  const ref = doc(collection(db, 'groupChats'));
  await setDoc(ref, {
    name:          groupName,
    members:       allMembers,
    createdBy:     creatorId,
    createdAt:     serverTimestamp(),
    lastMessage:   null,
    lastMessageAt: null,
    unreadCount:   {},
  });
  return ref.id;
}

export function subscribeToUserGroupChats(userId, callback) {
  const q = query(
    collection(db, 'groupChats'),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(q, snap => {
    const chats = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aMs = a.lastMessageAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.lastMessageAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
    callback(chats);
  });
}

export async function sendGroupMessage(groupId, data) {
  await addDoc(collection(db, 'groupChats', groupId, 'messages'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  const groupSnap = await getDoc(doc(db, 'groupChats', groupId));
  const members   = groupSnap.data()?.members ?? [];
  const unreadUpdate = {};
  members.forEach(uid => {
    if (uid !== data.userId) {
      const current = groupSnap.data()?.unreadCount?.[uid] ?? 0;
      unreadUpdate[`unreadCount.${uid}`] = current + 1;
    }
  });
  await updateDoc(doc(db, 'groupChats', groupId), {
    lastMessage:   data.text?.slice(0, 50) ?? '',
    lastMessageAt: serverTimestamp(),
    ...unreadUpdate,
  });
}

export function subscribeToGroupMessages(groupId, callback) {
  const q = query(
    collection(db, 'groupChats', groupId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  });
}

export async function markGroupChatAsRead(groupId, userId) {
  await updateDoc(doc(db, 'groupChats', groupId), {
    [`unreadCount.${userId}`]: 0,
  });
}

export async function getEligibleGroupMembers(userId) {
  const chatsSnap = await getDocs(query(
    collection(db, 'privateChats'),
    where('participants', 'array-contains', userId)
  ));
  const chattedIds = new Set();
  chatsSnap.docs.forEach(d => {
    d.data().participants.forEach(id => {
      if (id !== userId) chattedIds.add(id);
    });
  });

  const followSnap = await getDocs(query(
    collection(db, 'follows'),
    where('followerId', '==', userId)
  ));
  const followingIds = new Set(followSnap.docs.map(d => d.data().followingId));

  const followerSnap = await getDocs(query(
    collection(db, 'follows'),
    where('followingId', '==', userId)
  ));
  const followerIds = new Set(followerSnap.docs.map(d => d.data().followerId));

  const eligibleIds = new Set([...chattedIds, ...followingIds, ...followerIds]);

  const profiles = await Promise.all(
    [...eligibleIds].map(async id => {
      const snap = await getDoc(doc(db, 'users', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    })
  );
  return profiles.filter(Boolean);
}

// ─────────────────────────────────────────────
// 6. ENCRYPTION HELPERS (XOR-based)
// ─────────────────────────────────────────────
const CHAT_KEY = 'ExploreEase_Chat_2025';

function encryptMessage(text) {
  try {
    const xored = text.split('').map((char, i) => {
      const keyChar = CHAT_KEY[i % CHAT_KEY.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    return btoa(encodeURIComponent(xored));
  } catch (e) {
    return text;
  }
}

function decryptMessage(encrypted) {
  try {
    const xored = decodeURIComponent(atob(encrypted));
    return xored.split('').map((char, i) => {
      const keyChar = CHAT_KEY[i % CHAT_KEY.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
  } catch (e) {
    return encrypted;
  }
}
