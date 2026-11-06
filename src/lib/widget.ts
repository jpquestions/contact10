import { Platform } from 'react-native';

/** App Group shared with the iOS widget. Must match app.json and targets/widget. */
export const APP_GROUP = 'group.com.jpquestions.contact10';

type Storage = {
  set(key: string, value?: string | number): void;
  get(key: string): string | null;
  remove(key: string): void;
};
type StorageClass = { new (group: string): Storage; reloadWidget(name?: string): void };

let cls: StorageClass | null | undefined;
let storage: Storage | null = null;

// The native module only exists in development and store builds, not Expo Go.
function shared(): { storage: Storage; cls: StorageClass } | null {
  if (Platform.OS !== 'ios') return null;
  if (cls === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cls = require('@bacons/apple-targets').ExtensionStorage as StorageClass;
    } catch {
      cls = null;
    }
  }
  if (!cls) return null;
  try {
    storage ??= new cls(APP_GROUP);
    return { storage, cls };
  } catch {
    return null;
  }
}

/** What the widget needs to show totals and log points on its own. */
export type WidgetState = {
  refreshToken: string;
  apiKey: string;
  functionsBase: string;
  username: string;
  lifetimePoints: number;
  activeGameId: string | null;
  activeGameName: string | null;
  gamePoints: number | null;
  leaders: { username: string; points: number }[];
};

let lastWritten = '';

export function syncWidget(state: WidgetState | null) {
  const s = shared();
  if (!s) return;
  const json = state ? JSON.stringify(state) : '';
  if (json === lastWritten) return;
  lastWritten = json;
  if (state) s.storage.set('state', json);
  else {
    s.storage.remove('state');
    s.storage.remove('pending');
  }
  s.cls.reloadWidget();
}

export type PendingWidgetEntry = { entryId: string; gameId: string | null; amount: number };

/** Entries the widget logged while offline, for the app to deliver. */
export function takePendingWidgetEntries(): PendingWidgetEntry[] {
  const s = shared();
  if (!s) return [];
  const raw = s.storage.get('pending');
  if (!raw) return [];
  s.storage.remove('pending');
  try {
    return JSON.parse(raw) as PendingWidgetEntry[];
  } catch {
    return [];
  }
}

export const widgetSupported = () => shared() !== null;
