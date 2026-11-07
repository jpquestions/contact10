import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { db } from './firebase';
import type { AppNotification, Entry, Flag, Friendship, Game, Invite, Member, Profile } from './types';

type Live<T> = { data: T; loading: boolean; error: string | null };

function useQuery<T>(make: () => Query<DocumentData> | null, deps: unknown[]): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    const q = make();
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function useDocument<T>(path: string | null): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    return onSnapshot(
      doc(db, path),
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (err) => setState({ data: null, loading: false, error: err.message }),
    );
  }, [path]);
  return state;
}

export function useMyGames() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Game>(
    () => (uid ? query(collection(db, 'games'), where('memberIds', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(50)) : null),
    [uid],
  );
}

export const useGame = (id: string | undefined) => useDocument<Game>(id ? `games/${id}` : null);

/** Leaderboards for several games at once (the widget's live games). */
export function useMembersOf(gameIds: string[]) {
  const key = gameIds.join(',');
  const [byGame, setByGame] = useState<Record<string, Member[]>>({});
  useEffect(() => {
    const unsubs = gameIds.map((id) =>
      onSnapshot(
        query(collection(db, `games/${id}/members`), orderBy('points', 'desc')),
        (snap) => setByGame((m) => ({ ...m, [id]: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member) })),
        () => undefined,
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return byGame;
}

export function useMembers(gameId: string | undefined) {
  return useQuery<Member>(() => (gameId ? query(collection(db, `games/${gameId}/members`), orderBy('points', 'desc')) : null), [gameId]);
}

export function useFeed(gameId: string | undefined) {
  return useQuery<Entry>(
    () => (gameId ? query(collection(db, 'entries'), where('gameId', '==', gameId), orderBy('createdAt', 'desc'), limit(50)) : null),
    [gameId],
  );
}

export function useFlags(gameId: string | undefined) {
  return useQuery<Flag>(() => (gameId ? query(collection(db, `games/${gameId}/flags`), where('status', '==', 'pending')) : null), [gameId]);
}

export function useMyEntries() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Entry>(
    () => (uid ? query(collection(db, 'entries'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(20)) : null),
    [uid],
  );
}

export function useFriendships() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Friendship>(() => (uid ? query(collection(db, 'friendships'), where('participants', 'array-contains', uid)) : null), [uid]);
}

export function useInvites() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<Invite>(
    () => (uid ? query(collection(db, 'invites'), where('inviteeId', '==', uid), where('status', '==', 'pending')) : null),
    [uid],
  );
}

export function useNotifications() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<AppNotification>(
    () => (uid ? query(collection(db, `users/${uid}/notifications`), orderBy('createdAt', 'desc'), limit(50)) : null),
    [uid],
  );
}

export function useRewards() {
  const { user } = useAuth();
  const uid = user?.uid;
  return useQuery<{ id: string; rewardText: string }>(() => (uid ? collection(db, `users/${uid}/rewards`) : null), [uid]);
}

export function useUnlocks(userId: string | undefined) {
  return useQuery<{ id: string; reachedAt: { toDate(): Date } | null }>(
    () => (userId ? collection(db, `users/${userId}/unlocks`) : null),
    [userId],
  );
}

/** Profiles for a list of user ids (friends). Missing or hidden ones are skipped. */
export function useProfiles(ids: string[]) {
  const key = [...ids].sort().join(',');
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, `users/${id}`),
        (snap) => setProfiles((p) => (snap.exists() ? { ...p, [id]: snap.data() as Profile } : p)),
        () => undefined,
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return profiles;
}
