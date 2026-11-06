import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, ProfilePatch } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<{ error: { code?: string; message: string } | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error) setProfile(data as Profile);
    setProfileFor(userId);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      refreshProfile();
    } else {
      setProfile(null);
      setProfileFor(null);
    }
  }, [userId, refreshProfile]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return { error: { message: 'Not signed in' } };
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select('*')
        .single();
      if (!error) setProfile(data as Profile);
      return { error };
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const ready = sessionChecked && (userId === null || profileFor === userId);

  const value = useMemo(
    () => ({ ready, session, profile, refreshProfile, updateProfile, signOut }),
    [ready, session, profile, refreshProfile, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
