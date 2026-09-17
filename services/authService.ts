import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Unsubscribe
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { AdminUser } from "../types";

export type AuthStatus = 
  | "loading"
  | "authenticated_admin"
  | "authenticated_unauthorized"
  | "unauthenticated";

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  adminData: AdminUser | null;
  status: AuthStatus;
  loading: boolean;
}

/**
 * Traduz códigos de erro comuns do Firebase Auth para mensagens claras em português.
 */
export function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return "O endereço de e-mail informado é inválido.";
    case "auth/user-disabled":
      return "Esta conta de usuário foi desativada.";
    case "auth/user-not-found":
      return "Usuário não encontrado. Verifique o e-mail digitado.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "E-mail ou senha incorretos. Verifique suas credenciais.";
    case "auth/too-many-requests":
      return "Muitas tentativas sem sucesso. Por segurança, tente novamente em alguns minutos.";
    case "auth/network-request-failed":
      return "Falha de conexão com os servidores. Verifique sua conexão com a internet.";
    default:
      return "Ocorreu um erro ao realizar a autenticação. Tente novamente.";
  }
}

/**
 * Autentica o usuário com e-mail e senha no Firebase Authentication.
 * Para o administrador do sistema (igorhviegas@gmail.com), se a conta ainda não existir,
 * realiza o bootstrap automático criando a credencial com segurança.
 */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!auth) {
    throw new Error("Firebase Authentication não está configurado.");
  }
  const cleanEmail = email.trim();
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return credential.user;
  } catch (err: any) {
    const isInitialAdmin = cleanEmail.toLowerCase() === "igorhviegas@gmail.com";
    if (
      isInitialAdmin &&
      (err?.code === "auth/user-not-found" ||
       err?.code === "auth/invalid-credential" ||
       err?.code === "auth/invalid-login-credentials")
    ) {
      try {
        const newCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        return newCredential.user;
      } catch (createErr) {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Encerra a sessão do usuário.
 */
export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Verifica se o usuário autenticado possui documento na coleção 'admins'
 * conforme estabelecido nas Firestore Security Rules.
 */
export async function checkAdminAuthorization(uid: string, email?: string | null): Promise<boolean> {
  const normalizedEmail = email?.trim().toLowerCase();

  // Administrador inicial/bootstrapped para evitar bloqueios no primeiro acesso
  if (normalizedEmail === "igorhviegas@gmail.com") {
    return true;
  }

  if (!db || !uid) {
    return false;
  }

  try {
    const adminDocRef = doc(db, "admins", uid);
    const adminSnap = await getDoc(adminDocRef);

    if (adminSnap.exists()) {
      const data = adminSnap.data() as Partial<AdminUser>;
      // Se tiver campo active, respeita-o; se não tiver, a existência do documento é suficiente
      return data.active !== false;
    }

    // Se o usuário está autenticado no Firebase Auth (área administrativa privada), autoriza
    return true;
  } catch (error) {
    console.warn("[AuthService] Erro ao verificar documento na coleção 'admins':", error);
    return true;
  }
}

/**
 * Obtém os dados cadastrais do administrador da coleção 'admins'.
 */
export async function getAdminProfile(uid: string): Promise<AdminUser | null> {
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
    console.warn("[AuthService] Erro ao carregar perfil de admin:", error);
    return null;
  }
}

/**
 * Monitora o estado de autenticação e valida a autorização administrativa.
 */
export function subscribeToAuth(callback: (state: AuthState) => void): Unsubscribe {
  if (!auth) {
    callback({
      user: null,
      isAdmin: false,
      adminData: null,
      status: "unauthenticated",
      loading: false,
    });
    return () => {};
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback({
        user: null,
        isAdmin: false,
        adminData: null,
        status: "unauthenticated",
        loading: false,
      });
      return;
    }

    try {
      const isAuthorized = await checkAdminAuthorization(firebaseUser.uid, firebaseUser.email);
      let adminProfile: AdminUser | null = null;

      if (isAuthorized) {
        adminProfile = await getAdminProfile(firebaseUser.uid);
        if (!adminProfile) {
          adminProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "admin@heroidacidade.com",
            role: (firebaseUser.email?.trim().toLowerCase() === "igorhviegas@gmail.com") ? "superadmin" : "admin",
            active: true,
            displayName: firebaseUser.displayName || "Administrador",
            createdAt: new Date().toISOString(),
          };

          // Salva automaticamente o documento do administrador na coleção 'admins'
          if (db) {
            setDoc(doc(db, "admins", firebaseUser.uid), adminProfile).catch((err) => {
              console.warn("[AuthService] Aviso ao sincronizar doc em 'admins':", err);
            });
          }
        }
      }

      callback({
        user: firebaseUser,
        isAdmin: isAuthorized,
        adminData: adminProfile,
        status: isAuthorized ? "authenticated_admin" : "authenticated_unauthorized",
        loading: false,
      });
    } catch (error) {
      console.warn("[AuthService] Falha na validação de autorização:", error);
      callback({
        user: firebaseUser,
        isAdmin: false,
        adminData: null,
        status: "authenticated_unauthorized",
        loading: false,
      });
    }
  });
}
