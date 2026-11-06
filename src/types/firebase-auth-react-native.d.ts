// @firebase/auth ships getReactNativePersistence in its React Native build,
// but the package's top level "types" entry wins over the react-native
// condition, so TypeScript never sees it. Declare it here.
import type { Persistence } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
