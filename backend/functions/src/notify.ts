import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { NotificationPref } from './shared';
import { db } from './util';

export type Notice = {
  kind: string;
  pref: NotificationPref;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Writes an inbox notification for each recipient who has not muted the
 * category, then sends Expo pushes to their devices. Never throws: a failed
 * notification must not fail the action that caused it.
 */
export async function notify(recipients: Iterable<string>, notice: Notice, exclude?: string): Promise<void> {
  const ids = [...new Set(recipients)].filter((r) => r && r !== exclude);
  if (ids.length === 0) return;
  try {
    const users = await db().getAll(...ids.map((r) => db().doc(`users/${r}`)));
    const batch = db().batch();
    const messages: { to: string; title: string; body: string; data: Record<string, string>; sound: 'default' }[] = [];
    const tokenOwners = new Map<string, string>();

    for (const snap of users) {
      if (!snap.exists) continue;
      const prefs = (snap.get('notificationPrefs') ?? {}) as Record<string, boolean>;
      if (prefs[notice.pref] === false) continue;
      batch.set(db().collection(`users/${snap.id}/notifications`).doc(), {
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        data: notice.data ?? {},
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      const tokens = await db().collection(`users/${snap.id}/pushTokens`).get();
      for (const t of tokens.docs) {
        tokenOwners.set(t.id, snap.id);
        messages.push({
          to: t.id,
          title: notice.title,
          body: notice.body,
          data: { kind: notice.kind, ...(notice.data ?? {}) },
          sound: 'default',
        });
      }
    }
    await batch.commit();
    await sendPushes(messages, tokenOwners);
  } catch (err) {
    logger.error('notify failed', { kind: notice.kind, err });
  }
}

async function sendPushes(
  messages: { to: string; title: string; body: string; data: Record<string, string>; sound: 'default' }[],
  tokenOwners: Map<string, string>,
) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      logger.warn('expo push failed', { status: res.status });
      continue;
    }
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const cleanup = db().batch();
    let stale = 0;
    json.data?.forEach((ticket, j) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const token = chunk[j].to;
        const owner = tokenOwners.get(token);
        if (owner) {
          cleanup.delete(db().doc(`users/${owner}/pushTokens/${token}`));
          stale++;
        }
      }
    });
    if (stale) await cleanup.commit();
  }
}

/** Accepted friends of a user. */
export async function friendIds(uid: string): Promise<string[]> {
  const snap = await db()
    .collection('friendships')
    .where('participants', 'array-contains', uid)
    .where('status', '==', 'accepted')
    .get();
  return snap.docs.map((d) => (d.get('userA') === uid ? d.get('userB') : d.get('userA')) as string);
}
