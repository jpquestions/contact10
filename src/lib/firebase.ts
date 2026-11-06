import AsyncStorage from '@react-native-async-storage/async-storage';
// Imported from @firebase/auth so the React Native build (and its
// getReactNativePersistence) is picked up through the react-native condition.
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from '@firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(config.apiKey && config.projectId && config.appId);

const firstLoad = getApps().length === 0;
export const app = firstLoad ? initializeApp(isConfigured ? config : { projectId: 'not-configured', apiKey: 'x' }) : getApp();

// Keep the session across launches. initializeAuth may only run once, so a
// fast refresh reuses the existing instance.
export const auth: Auth =
  firstLoad && Platform.OS !== 'web'
    ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : getAuth(app);

export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
