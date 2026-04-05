import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registerForPushNotifications = async (userId) => {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  if (userId) {
    await updateDoc(doc(db, 'users', userId), { pushToken: token });
  }
  return token;
};

export const scheduleLocalNotification = async (title, body, trigger = null) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: trigger ?? { seconds: 1 },
  });
};
