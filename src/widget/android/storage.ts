import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingWidgetEntry, WidgetState } from '../core';

// The Android widget runs as a background task in the app's own process, so
// it shares AsyncStorage with the app.
const KEYS = {
  state: 'contact10.widget.state',
  target: 'contact10.widget.target',
  pending: 'contact10.widget.pending',
  token: 'contact10.widget.idToken',
  error: 'contact10.widget.error',
};

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setJson(key: string, value: unknown) {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort.
  }
}

export const androidWidgetStore = {
  state: () => getJson<WidgetState>(KEYS.state),
  setState: (s: WidgetState | null) => setJson(KEYS.state, s),
  target: () => getJson<string>(KEYS.target),
  setTarget: (t: string | null) => setJson(KEYS.target, t),
  pending: async () => (await getJson<PendingWidgetEntry[]>(KEYS.pending)) ?? [],
  setPending: (p: PendingWidgetEntry[]) => setJson(KEYS.pending, p.length ? p : null),
  error: () => getJson<string>(KEYS.error),
  setError: (e: string | null) => setJson(KEYS.error, e),
  tokenCache: {
    get: () => getJson<{ token: string; expiresAt: number }>(KEYS.token),
    set: (v: { token: string; expiresAt: number }) => setJson(KEYS.token, v),
  },
  clear: async () => {
    for (const k of Object.values(KEYS)) await setJson(k, null);
  },
};
