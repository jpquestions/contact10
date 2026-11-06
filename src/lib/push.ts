import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Asks for permission and saves this device's push token. Safe to call often. */
export async function registerForPush(uid: string): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!Device.isDevice || Platform.OS === 'web' || !projectId()) return 'unavailable';
  try {
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!status.granted) return 'denied';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    registeredToken = token;
    await setDoc(doc(db, `users/${uid}/pushTokens/${token}`), {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      updatedAt: serverTimestamp(),
    });
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

/** Stops pushes to this device for the signed out user. */
export async function unregisterPush(uid: string) {
  if (!registeredToken) return;
  try {
    await deleteDoc(doc(db, `users/${uid}/pushTokens/${registeredToken}`));
  } catch {
    // Signing out still proceeds.
  }
  registeredToken = null;
}
