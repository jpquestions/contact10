import { Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { endGameNow } from './games';
import { notify } from './notify';
import { db } from './util';

/** Ends games whose time is up and warns members an hour before the end. */
export const gameClock = onSchedule('every 15 minutes', async () => {
  const now = Timestamp.now();

  const due = await db().collection('games').where('status', '==', 'active').where('endsAt', '<=', now).get();
  for (const game of due.docs) await endGameNow(game.id);

  const soon = await db()
    .collection('games')
    .where('status', '==', 'active')
    .where('endingSoonNotified', '==', false)
    .where('endsAt', '<=', Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000))
    .get();
  for (const game of soon.docs) {
    await game.ref.update({ endingSoonNotified: true });
    await notify(game.get('memberIds') as string[], {
      kind: 'game_ending',
      pref: 'gameEnding',
      title: `${game.get('name')} ends soon`,
      body: 'Less than an hour left. Get your last points in.',
      data: { gameId: game.id },
    });
  }
});
