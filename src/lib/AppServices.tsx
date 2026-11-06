import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { firebaseApiKey, functionsBase } from './firebase';
import { useGame, useMembers } from './hooks';
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
  const activeId = profile?.activeGameId ?? undefined;
  const { data: game } = useGame(activeId);
  const { data: members } = useMembers(activeId);

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

  // Keep the home screen widget's totals and session current.
  useEffect(() => {
    if (!user || !profile?.username) return;
    const live = game && isLive(game) ? game : null;
    syncWidget({
      refreshToken: user.refreshToken,
      apiKey: firebaseApiKey ?? '',
      functionsBase,
      username: profile.username,
      lifetimePoints: profile.lifetimePoints,
      activeGameId: live?.id ?? null,
      activeGameName: live?.name ?? null,
      gamePoints: live ? (members.find((m) => m.id === user.uid)?.points ?? 0) : null,
      leaders: live ? members.slice(0, 5).map((m) => ({ username: m.username, points: m.points })) : [],
    });
  }, [user, profile?.username, profile?.lifetimePoints, game, members]);

  return null;
}
