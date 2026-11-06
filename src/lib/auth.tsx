import { onAuthStateChanged, signOut as firebaseSignOut, type User } from '@firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { auth, db, functions } from './firebase';
import { unregisterPush } from './push';
import { syncWidget } from './widget';
import type { Profile, ProfilePatch } from './types';

type Result = { error: string | null; code?: string };

type AuthState = {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  updateProfile: (patch: ProfilePatch) => Promise<Result>;
  claimUsername: (username: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const claimUsernameFn = httpsCallable<{ username: string }, { username: string }>(functions, 'claimUsername');

function errorInfo(err: unknown): Result {
  const e = err as { code?: string; message?: string };
  return { error: e.message ?? 'Something went wrong.', code: e.code };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setAuthChecked(true);
      }),
    [],
  );

  const uid = user?.uid ?? null;

  // Live profile. On first sign in the document does not exist yet, so the
  // app creates it with the defaults the security rules require.
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setProfileFor(null);
      return;
    }
    const ref = doc(db, 'users', uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as Profile);
          setProfileFor(uid);
        } else {
          setDoc(ref, {
            username: null,
            displayName: null,
            avatarUrl: null,
            lifetimePoints: 0,
            activeGameId: null,
            seenWidgetIntroLaunch: false,
            seenWidgetIntroFirstScore: false,
            createdAt: serverTimestamp(),
          }).catch(() => setProfileFor(uid));
        }
      },
      () => setProfileFor(uid),
    );
  }, [uid]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch): Promise<Result> => {
      if (!uid) return { error: 'Not signed in.' };
      try {
        await updateDoc(doc(db, 'users', uid), patch);
        return { error: null };
      } catch (err) {
        return errorInfo(err);
      }
    },
    [uid],
  );

  const claimUsername = useCallback(async (username: string): Promise<Result> => {
    try {
      await claimUsernameFn({ username });
      return { error: null };
    } catch (err) {
      return errorInfo(err);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (uid) await unregisterPush(uid);
    syncWidget(null);
    await firebaseSignOut(auth);
  }, [uid]);

  const ready = authChecked && (uid === null || profileFor === uid);

  const value = useMemo(
    () => ({ ready, user, profile, updateProfile, claimUsername, signOut }),
    [ready, user, profile, updateProfile, claimUsername, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
