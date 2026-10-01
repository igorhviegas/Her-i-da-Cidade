import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { handleManyChatOrderRequest } from './manychat-handler.js';

const MANYCHAT_WEBHOOK_SECRET = defineSecret('MANYCHAT_WEBHOOK_SECRET');
if (getApps().length === 0) initializeApp();
const db = getFirestore();

export const receiveManyChatOrder = onRequest({
  region: 'us-central1',
  invoker: 'public',
  cors: false,
  maxInstances: 10,
  timeoutSeconds: 8,
  memory: '256MiB',
  secrets: [MANYCHAT_WEBHOOK_SECRET],
}, async (req, res) => handleManyChatOrderRequest(req, res, {
  database: db,
  secret: MANYCHAT_WEBHOOK_SECRET.value(),
  logger,
}));
