import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useAuth } from './auth';
import { firebaseApiKey, functionsBase } from './firebase';
import { useMembersOf, useMyGames } from './hooks';
import { registerForPush } from './push';
import { isLive } from './types';
import { syncWidget } from './widget';

function openFromNotification(data: Record<string, unknown> | undefined) {
  const gameId = typeof data?.gameId === 'string' ? data.gameId : null;
  router.push(gameId ? `/game/${gameId}` : '/notifications');
}

/** Background work for a signed in, onboarded user. Renders nothing. */
export function AppServices() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const { data: games } = useMyGames();
  const live = useMemo(() => games.filter((g) => isLive(g)).slice(0, 6), [games]);
  const members = useMembersOf(live.map((g) => g.id));

  useEffect(() => {
    if (uid) registerForPush(uid);
  }, [uid]);

  useEffect(() => {
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification.request.content.data),
    );
    return () => sub.remove();
  }, []);

  // Keep the home screen widgets' totals, games and session current.
  useEffect(() => {
    if (!user || !profile?.username) return;
    syncWidget({
      refreshToken: user.refreshToken,
      apiKey: firebaseApiKey ?? '',
      functionsBase,
      username: profile.username,
      lifetimePoints: profile.lifetimePoints,
      activeGameId: profile.activeGameId ?? null,
      games: live.map((g) => {
        const board = members[g.id] ?? [];
        return {
          id: g.id,
          name: g.name,
          points: board.find((m) => m.id === user.uid)?.points ?? 0,
          leaders: board.slice(0, 5).map((m) => ({ username: m.username, points: m.points })),
        };
      }),
    });
  }, [user, profile?.username, profile?.lifetimePoints, profile?.activeGameId, live, members]);

  return null;
}
