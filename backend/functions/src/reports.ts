import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db, id, input, oneOf, requireUid, str } from './util';

const TARGETS = ['user', 'game'] as const;
const REASONS = ['harassment', 'hate', 'sexual', 'spam', 'cheating', 'other'] as const;

/**
 * Files a report about a user or a game for the operator to review in the
 * Firebase console (reports collection). Required by App Store guideline 1.2
 * for apps with user generated content. Clients cannot read reports.
 */
export const reportContent = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const targetType = oneOf(data, 'targetType', TARGETS);
  const targetId = id(data, 'targetId')!;
  const reason = oneOf(data, 'reason', REASONS);
  const details = str(data, 'details', { max: 500, optional: true });
  if (targetType === 'user' && targetId === uid) throw new HttpsError('invalid-argument', 'You cannot report yourself.');

  // One open report per reporter and target is enough.
  const reportId = `${uid}_${targetType}_${targetId}`;
  await db().doc(`reports/${reportId}`).set({
    reporterId: uid,
    targetType,
    targetId,
    reason,
    details,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
