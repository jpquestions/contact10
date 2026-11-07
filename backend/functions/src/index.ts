import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

// Caps how far any one function can scale, which also caps the bill.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { deleteAccount } from './account';
export { flagEntry, resolveFlag } from './flags';
export { blockUser, removeFriend, respondToFriendRequest, sendFriendRequest, unblockUser } from './friends';
export {
  createGame,
  createInviteLink,
  endGame,
  inviteFriends,
  joinGameByCode,
  leaveGame,
  removeMember,
  respondToInvite,
} from './games';
export { gameClock } from './scheduled';
export { addPoints, removePoints } from './scoring';
export { reportContent } from './reports';
export { claimUsername } from './usernames';
