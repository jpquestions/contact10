import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

// Caps how far any one function can scale, which also caps the bill.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { claimUsername } from './usernames';
