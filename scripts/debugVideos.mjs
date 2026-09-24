// scripts/debugVideos.mjs
// Diagnostic script that uses Firebase Admin SDK (already configured via GOOGLE_APPLICATION_CREDENTIALS)
// It lists documents in the 'videos' collection and prints key fields.

import admin from 'firebase-admin';
import { execSync } from 'child_process';

// Initialize Firebase Admin using the existing GOOGLE_APPLICATION_CREDENTIALS env var
if (!admin.apps.length) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('⚠️ GOOGLE_APPLICATION_CREDENTIALS is not set in this environment. Cannot initialize Firebase Admin.');
    process.exit(1);
  }
  try {
    const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.info('[debugVideos] Firebase Admin initialized.');
  } catch (e) {
    console.error('❌ Failed to initialize Firebase Admin:', e);
    process.exit(1);
  }
}

const db = admin.firestore();

async function listVideos() {
  try {
    const snap = await db.collection('videos').get();
    console.log(`📹 Total documents in 'videos' collection: ${snap.size}`);
    if (snap.empty) {
      console.log('⚠️ No video documents found.');
      return;
    }
    let count = 0;
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`--- Document ID: ${doc.id}`);
      console.log(`title       : ${data.title || '(missing)'}`);
      console.log(`category    : ${data.category || (Array.isArray(data.categories) ? data.categories[0] : '(missing)')}`);
      console.log(`instagramId : ${data.instagramId || '(missing)'}`);
      console.log(`instagramUrl: ${data.instagramUrl || '(missing)'}`);
      console.log(`active      : ${data.active !== undefined ? data.active : '(missing)'}`);
      console.log(`order       : ${data.order !== undefined ? data.order : '(missing)'}`);
      console.log(`keywords    : ${Array.isArray(data.keywords) ? data.keywords.join(', ') : '(missing)'}`);
      console.log('');
      count++;
      if (count >= 10) return;
    });
  } catch (err) {
    console.error('❌ Error fetching videos collection:', err);
  }
}

async function showFirestoreRules() {
  try {
    const output = execSync('npx -y firebase-tools firestore:rules:get', { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    console.log('📜 Current Firestore Rules (excerpt):');
    console.log(output.split('\n').slice(0, 120).join('\n'));
  } catch (e) {
    console.warn('⚠️ Could not retrieve Firestore rules via firebase-tools (maybe not installed or not logged in).');
  }
}

(async () => {
  await listVideos();
  await showFirestoreRules();
  process.exit(0);
})();
