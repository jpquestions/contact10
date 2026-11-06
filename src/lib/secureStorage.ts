import * as SecureStore from 'expo-secure-store';

// Supabase sessions can exceed what the keychain comfortably holds in one
// item, so values are split into chunks under numbered keys.
const CHUNK = 1800;

function countKey(key: string) {
  return `${key}.chunks`;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(countKey(key));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const total = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < total; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(countKey(key), String(total));
  },

  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(countKey(key));
    await SecureStore.deleteItemAsync(countKey(key));
    for (let i = 0; i < Number(count ?? 0); i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  },
};
