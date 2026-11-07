import { Platform } from 'react-native';
import type { PendingWidgetEntry, WidgetState } from '../widget/core';

export type { WidgetState } from '../widget/core';

/** App Group shared with the iOS widget. Must match app.json and targets/widget. */
export const APP_GROUP = 'group.com.jpquestions.contact10';

type IosStorage = { set(key: string, value?: string | number): void; get(key: string): string | null; remove(key: string): void };
type IosStorageClass = { new (group: string): IosStorage; reloadWidget(name?: string): void };

let iosClass: IosStorageClass | null | undefined;
let iosStorage: IosStorage | null = null;

// The native modules only exist in development and store builds, not Expo Go.
function ios(): { storage: IosStorage; cls: IosStorageClass } | null {
  if (Platform.OS !== 'ios') return null;
  if (iosClass === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      iosClass = require('@bacons/apple-targets').ExtensionStorage as IosStorageClass;
    } catch {
      iosClass = null;
    }
  }
  if (!iosClass) return null;
  try {
    iosStorage ??= new iosClass(APP_GROUP);
    return { storage: iosStorage, cls: iosClass };
  } catch {
    return null;
  }
}

function android() {
  if (Platform.OS !== 'android') return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { androidWidgetStore } = require('../widget/android/storage') as typeof import('../widget/android/storage');
    const { refreshAndroidWidgets } = require('../widget/android/task-handler') as typeof import('../widget/android/task-handler');
    /* eslint-enable @typescript-eslint/no-require-imports */
    return { store: androidWidgetStore, refresh: refreshAndroidWidgets };
  } catch {
    return null;
  }
}

let lastWritten = '';

/** Shares the signed in user's totals and live games with the home screen widgets. */
export function syncWidget(state: WidgetState | null) {
  const json = state ? JSON.stringify(state) : '';
  if (json === lastWritten) return;
  lastWritten = json;

  const i = ios();
  if (i) {
    if (state) i.storage.set('state', json);
    else ['state', 'pending', 'target', 'idToken', 'idTokenExpiry', 'lastError'].forEach((k) => i.storage.remove(k));
    i.cls.reloadWidget();
  }

  const a = android();
  if (a) {
    (async () => {
      if (state) await a.store.setState(state);
      else await a.store.clear();
      await a.refresh().catch(() => undefined);
    })();
  }
}

/** Entries a widget logged while offline, for the app to deliver. */
export async function takePendingWidgetEntries(): Promise<PendingWidgetEntry[]> {
  const i = ios();
  if (i) {
    const raw = i.storage.get('pending');
    if (!raw) return [];
    i.storage.remove('pending');
    try {
      return JSON.parse(raw) as PendingWidgetEntry[];
    } catch {
      return [];
    }
  }
  const a = android();
  if (a) {
    const pending = await a.store.pending();
    await a.store.setPending([]);
    return pending;
  }
  return [];
}
