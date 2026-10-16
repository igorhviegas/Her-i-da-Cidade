import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, Auth } from "firebase/auth";
import { app, setAuth } from "./firebase";

// Sem popupRedirectResolver (o site só usa e-mail/senha): é ele que baixava o iframe de login do Google (~90 KB) a cada visita.
// Mesmas persistências do getAuth(), então a sessão salva continua valendo.
function createAuth(): Auth | null {
  if (!app) return null;
  try {
    return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence] });
  } catch {
    // Já inicializado (recarga a quente do Vite)
    return getAuth(app);
  }
}

export const auth = createAuth();
if (auth) setAuth(auth);
