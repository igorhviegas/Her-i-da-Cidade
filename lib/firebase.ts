import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseAppletConfig from "../firebase-applet-config.json";

/**
 * Configuração do Firebase Web App.
 * Prioriza variáveis de ambiente do Vite, com fallback para firebase-applet-config.json.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseAppletConfig.measurementId,
  firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey.trim().length > 0 &&
  !firebaseConfig.apiKey.startsWith("YOUR_")
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Utilizar firestoreDatabaseId se especificado e diferente de (default)
    db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);

    // Validação de conectividade não-bloqueante
    if (typeof window !== "undefined") {
      getDocFromServer(doc(db, "system", "ping"))
        .catch(() => {
          // Normal em coleções não iniciadas
        });
    }
  } catch (error) {
    console.warn("[Firebase] Inicialização do SDK falhou:", error);
  }
} else {
  if (typeof window !== "undefined") {
    console.info(
      "[Firebase] Configurações do Firebase não encontradas. O site utilizará a base de dados local padrão."
    );
  }
}

export { app, auth, db };
