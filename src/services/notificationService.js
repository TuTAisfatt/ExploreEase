import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, orderBy, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─────────────────────────────────────────────
// 1. PUSH NOTIFICATION HANDLER
// ─────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─────────────────────────────────────────────
// 2. REGISTER FOR PUSH NOTIFICATIONS
// ─────────────────────────────────────────────
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  let token = null;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch (e) {
    console.warn('Push token unavailable:', e.message);
    return null;
  }
  if (userId) {
    await updateDoc(doc(db, 'users', userId), { pushToken: token });
  }
  return token;
}

// ─────────────────────────────────────────────
// 3. CREATE NOTIFICATION IN FIRESTORE
// ─────────────────────────────────────────────
export async function createNotification(userId, { title, body, type, data = {} }) {
  await addDoc(collection(db, 'notifications'), {
    userId,
    title,
    body,
    type,      // 'alert' | 'offer' | 'message' | 'event' | 'review' | 'system'
    data,
    read:      false,
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// 4. GET NOTIFICATIONS FOR USER
// ─────────────────────────────────────────────
export async function getNotifications(userId) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// 5. MARK SINGLE NOTIFICATION AS READ
// ─────────────────────────────────────────────
export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

// ─────────────────────────────────────────────
// 6. MARK ALL NOTIFICATIONS AS READ
// ─────────────────────────────────────────────
export async function markAllNotificationsRead(userId) {
  const q    = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
}

// ─────────────────────────────────────────────
// 7. DELETE SINGLE NOTIFICATION
// ─────────────────────────────────────────────
export async function deleteNotification(notifId) {
  await deleteDoc(doc(db, 'notifications', notifId));
}

// ─────────────────────────────────────────────
// 8. DELETE ALL NOTIFICATIONS FOR USER
// ─────────────────────────────────────────────
export async function deleteAllNotifications(userId) {
  const q    = query(collection(db, 'notifications'), where('userId', '==', userId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ─────────────────────────────────────────────
// 9. SCHEDULE LOCAL NOTIFICATION
// ─────────────────────────────────────────────
export async function scheduleLocalNotification(title, body, trigger = null) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: trigger ?? { seconds: 1 },
  });
}

// ─────────────────────────────────────────────
// 10. HELPER: NOTIFY ON JOIN EVENT
// ─────────────────────────────────────────────
export async function notifyJoinedEvent(userId, eventTitle) {
  await createNotification(userId, {
    title: '🎉 You joined an event!',
    body:  `You're now attending: ${eventTitle}`,
    type:  'event',
  });
}

// ─────────────────────────────────────────────
// 11. HELPER: NOTIFY ON BOOKMARK
// ─────────────────────────────────────────────
export async function notifyBookmarked(userId, placeName) {
  await createNotification(userId, {
    title: '🔖 Place bookmarked!',
    body:  `${placeName} has been saved to your bookmarks.`,
    type:  'alert',
  });
}

// ─────────────────────────────────────────────
// 12. HELPER: WELCOME NOTIFICATION
// ─────────────────────────────────────────────
export async function notifyWelcome(userId) {
  await createNotification(userId, {
    title: '👋 Welcome to ExploreEase!',
    body:  'Start exploring amazing places around Ho Chi Minh City.',
    type:  'system',
  });
}

// ─────────────────────────────────────────────
// 13. SEND EXPO PUSH NOTIFICATION TO A USER
// ─────────────────────────────────────────────
export async function sendPushToUser(targetUserId, { title, body, data = {} }) {
  try {
    const userSnap = await getDoc(doc(db, 'users', targetUserId));
    if (!userSnap.exists()) return;
    const pushToken = userSnap.data()?.pushToken;
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

    await fetch('https://exp.host/--/exponent/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        to:    pushToken,
        title,
        body,
        data,
        sound: 'default',
      }),
    });
  } catch (e) {
    console.error('sendPushToUser error:', e);
  }
}

// ─────────────────────────────────────────────
// 14. NOTIFY ORGANIZER WHEN SOMEONE JOINS
// ─────────────────────────────────────────────
export async function notifyOrganizerJoin(organizerId, joinerName, eventTitle) {
  await createNotification(organizerId, {
    title: '👥 New attendee!',
    body:  `${joinerName} just joined your event: ${eventTitle}`,
    type:  'event',
  });
  await sendPushToUser(organizerId, {
    title: '👥 New attendee!',
    body:  `${joinerName} just joined your event: ${eventTitle}`,
  });
}

// ─────────────────────────────────────────────
// 15. NOTIFY REVIEWER WHEN THEIR REVIEW IS HELPFUL
// ─────────────────────────────────────────────
export async function notifyReviewHelpful(reviewUserId, placeName) {
  await createNotification(reviewUserId, {
    title: '👍 Your review was helpful!',
    body:  `Someone found your review of ${placeName} helpful.`,
    type:  'review',
  });
  await sendPushToUser(reviewUserId, {
    title: '👍 Your review was helpful!',
    body:  `Someone found your review of ${placeName} helpful.`,
  });
}

// ─────────────────────────────────────────────
// 16. SCHEDULE EVENT REMINDER (1 hour before)
// ─────────────────────────────────────────────
export async function scheduleEventReminder(eventTitle, startDateMs) {
  const msUntilReminder = startDateMs - Date.now() - (60 * 60 * 1000);
  if (msUntilReminder <= 0) return;
  const secondsUntil = Math.floor(msUntilReminder / 1000);
  await scheduleLocalNotification(
    '⏰ Event starting soon!',
    `${eventTitle} starts in 1 hour.`,
    { seconds: secondsUntil }
  );
}
