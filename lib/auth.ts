import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AdminUser } from "../types";

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  adminData: AdminUser | null;
  loading: boolean;
}

/**
 * Autentica o usuário com e-mail e senha.
 */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!auth) {
    throw new Error("Firebase Authentication não está configurado. Verifique as variáveis de ambiente.");
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/**
 * Encerra a sessão do usuário.
 */
export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Verifica se um determinado UID ou email possui privilégios de administrador.
 */
export async function checkIsAdmin(uid: string, email?: string | null): Promise<boolean> {
  if (email === "igorhviegas@gmail.com") return true;
  if (!db || !uid) return false;

  try {
    const adminDocRef = doc(db, "admins", uid);
    const adminSnap = await getDoc(adminDocRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data() as AdminUser;
      return Boolean(data.active === true);
    }
    return false;
  } catch (error) {
    console.warn("[Auth] Erro ao verificar permissões de administrador:", error);
    return false;
  }
}

/**
 * Obtém os dados de perfil do administrador no Firestore.
 */
export async function getAdminData(uid: string): Promise<AdminUser | null> {
  if (!db || !uid) return null;

  try {
    const adminDocRef = doc(db, "admins", uid);
    const adminSnap = await getDoc(adminDocRef);

    if (adminSnap.exists()) {
      return {
        ...(adminSnap.data() as Omit<AdminUser, "uid">),
        uid: adminSnap.id,
      };
    }
    return null;
  } catch (error) {
    console.warn("[Auth] Erro ao buscar dados de admin:", error);
    return null;
  }
}

/**
 * Escuta mudanças no estado de autenticação e valida se o usuário conectado é administrador.
 */
export function subscribeToAuthState(
  callback: (state: AuthState) => void
): Unsubscribe {
  if (!auth) {
    callback({
      user: null,
      isAdmin: false,
      adminData: null,
      loading: false,
    });
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({
        user: null,
        isAdmin: false,
        adminData: null,
        loading: false,
      });
      return;
    }

    // Usuário autenticado: verificar papel de administrador
    try {
      const adminData = await getAdminData(user.uid);
      const isBootstrappedAdmin = user.email === "igorhviegas@gmail.com";
      const isAdmin = Boolean(isBootstrappedAdmin || (adminData && adminData.active));

      callback({
        user,
        isAdmin,
        adminData: adminData || (isBootstrappedAdmin ? {
          uid: user.uid,
          email: user.email || "igorhviegas@gmail.com",
          role: "superadmin",
          active: true,
          createdAt: new Date().toISOString(),
        } : null),
        loading: false,
      });
    } catch (_err) {
      const isBootstrappedAdmin = user.email === "igorhviegas@gmail.com";
      callback({
        user,
        isAdmin: isBootstrappedAdmin,
        adminData: isBootstrappedAdmin ? {
          uid: user.uid,
          email: user.email || "igorhviegas@gmail.com",
          role: "superadmin",
          active: true,
          createdAt: new Date().toISOString(),
        } : null,
        loading: false,
      });
    }
  });
}
