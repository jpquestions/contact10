import AsyncStorage from '@react-native-async-storage/async-storage';
// Imported from @firebase/auth so the React Native build (and its
// getReactNativePersistence) is picked up through the react-native condition.
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from '@firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

// The Contact 10 web app config. These values identify the project and are
// public by design; access is controlled by backend/firestore.rules. Any of
// them can be overridden with EXPO_PUBLIC_FIREBASE_* variables in .env, for
// example to point a build at a staging project.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBSKZW_8Lvx499GM_kthIiPMKWHmsRElx8',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'contact-10-1c0fd.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'contact-10-1c0fd',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'contact-10-1c0fd.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '100319233016',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:100319233016:web:0ff168101d827c15a48c0d',
};

/** Base URL of the deployed callable functions, used by the iOS widget. */
export const functionsBase = `https://us-central1-${config.projectId}.cloudfunctions.net`;
export const firebaseApiKey = config.apiKey;

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
