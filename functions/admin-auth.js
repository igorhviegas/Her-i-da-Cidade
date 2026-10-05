// Valida o ID token do Firebase e confere o documento admins/{uid}; mesmo mecanismo de /api/upload-thumbnail.
// Fica fora de api/ pelo mesmo motivo de firebase-admin.js.

/** Retorna 'unauthenticated' | 'forbidden' | 'authorized'. Lança se Firebase/config estiverem indisponíveis. */
export async function authorizeAdminRequest(req, env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '';
  const apiKey = env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || '';
  const databaseId = env.FIRESTORE_DATABASE_ID || env.VITE_FIRESTORE_DATABASE_ID || '(default)';

  const match = req.headers?.authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return 'unauthenticated';
  const idToken = match[1];
  if (!apiKey) throw new Error('Firebase API key não configurada.');
  if (!projectId) throw new Error('Firebase project ID não configurado.');

  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (lookup.status === 400 || lookup.status === 401) return 'unauthenticated';
  if (!lookup.ok) throw new Error('Firebase Authentication indisponível.');
  const uid = (await lookup.json()).users?.[0]?.localId;
  if (!uid) return 'unauthenticated';

  const doc = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/admins/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (doc.status === 403 || doc.status === 404) return 'forbidden';
  if (!doc.ok) throw new Error('Firestore indisponível.');
  return 'authorized';
}
