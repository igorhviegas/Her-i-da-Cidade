import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { PublicSiteConfig } from "../types";

export const SITE_CONFIG_COLLECTION = "siteConfig";
export const PUBLIC_CONFIG_DOC = "public";

/**
 * URL hardcoded original utilizada temporariamente como fallback de segurança
 * caso o Firestore esteja indisponível ou ainda não inicializado.
 * 
 * NOTA DE MIGRAÇÃO:
 * Esse fallback existe somente para contingência e deverá ser removido
 * futuramente após a validação completa da infraestrutura em produção.
 */
export const TEMPORARY_FALLBACK_WHATSAPP_URL = "https://wa.me/5531999044206";

export const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  whatsappUrl: TEMPORARY_FALLBACK_WHATSAPP_URL,
};

/**
 * Normaliza e valida URL do WhatsApp para garantir formato padrão.
 */
export function isValidWhatsAppUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const validHosts = [
      "wa.me",
      "api.whatsapp.com",
      "web.whatsapp.com",
      "chat.whatsapp.com"
    ];
    return validHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Constrói uma URL do WhatsApp preservando mensagem pré-preenchida.
 * Se o link base já tiver parâmetros, adiciona o parâmetro text adequadamente.
 */
export function buildWhatsAppLink(baseUrl: string, customMessage?: string): string {
  const url = baseUrl?.trim() || TEMPORARY_FALLBACK_WHATSAPP_URL;
  if (!customMessage) return url;

  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set("text", customMessage);
    return urlObj.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}text=${encodeURIComponent(customMessage)}`;
  }
}

/**
 * Obtém a configuração pública atual do site no Firestore ('siteConfig/public').
 * Caso o Firestore não esteja configurado ou ocorra erro, retorna o fallback temporário.
 */
export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  if (!db) {
    console.warn("[siteConfigService] Firestore não inicializado. Utilizando fallback temporário.");
    return DEFAULT_PUBLIC_SITE_CONFIG;
  }

  try {
    const docRef = doc(db, SITE_CONFIG_COLLECTION, PUBLIC_CONFIG_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        whatsappUrl: data.whatsappUrl || TEMPORARY_FALLBACK_WHATSAPP_URL,
        updatedAt: data.updatedAt,
        ...data,
      };
    }

    // Se o documento não existir, tenta inicializá-lo com os valores padrão
    try {
      await setDoc(docRef, {
        ...DEFAULT_PUBLIC_SITE_CONFIG,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return DEFAULT_PUBLIC_SITE_CONFIG;
    } catch {
      // Se não tiver permissão de escrita pública para criar, apenas retorna o fallback padrão
      return DEFAULT_PUBLIC_SITE_CONFIG;
    }
  } catch (error) {
    console.error("[siteConfigService] Erro ao buscar configuração pública do Firestore:", error);
    return DEFAULT_PUBLIC_SITE_CONFIG;
  }
}

/**
 * Retorna diretamente a URL do WhatsApp configurada ou o fallback de segurança.
 */
export async function getWhatsAppUrl(): Promise<string> {
  const config = await getPublicSiteConfig();
  return config.whatsappUrl || TEMPORARY_FALLBACK_WHATSAPP_URL;
}

/**
 * Atualiza o documento 'siteConfig/public' no Firestore.
 * Utilizado pelo Painel Administrativo.
 */
export async function updatePublicSiteConfig(
  updates: Partial<PublicSiteConfig>
): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }

  if (updates.whatsappUrl !== undefined) {
    const trimmed = updates.whatsappUrl.trim();
    if (!trimmed) {
      throw new Error("O link do WhatsApp não pode ser vazio.");
    }
    if (!isValidWhatsAppUrl(trimmed)) {
      throw new Error("Formato de link do WhatsApp inválido. Utilize uma URL válida (ex: https://wa.me/5531999044206).");
    }
  }

  const docRef = doc(db, SITE_CONFIG_COLLECTION, PUBLIC_CONFIG_DOC);
  const payload: Record<string, any> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  try {
    try {
      await updateDoc(docRef, payload);
    } catch (err: any) {
      // Se o documento não existir ainda, cria com setDoc merge
      if (err?.code === "not-found" || err?.message?.includes("No document to update")) {
        await setDoc(
          docRef,
          {
            ...payload,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        throw err;
      }
    }
  } catch (error: any) {
    console.error("[siteConfigService] Erro ao atualizar siteConfig/public:", error);
    throw error;
  }
}

/**
 * Assina mudanças em tempo real em 'siteConfig/public'.
 */
export function subscribeToPublicSiteConfig(
  onUpdate: (config: PublicSiteConfig) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!db) {
    onUpdate(DEFAULT_PUBLIC_SITE_CONFIG);
    return () => {};
  }

  try {
    const docRef = doc(db, SITE_CONFIG_COLLECTION, PUBLIC_CONFIG_DOC);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          onUpdate({
            whatsappUrl: data.whatsappUrl || TEMPORARY_FALLBACK_WHATSAPP_URL,
            updatedAt: data.updatedAt,
            ...data,
          });
        } else {
          onUpdate(DEFAULT_PUBLIC_SITE_CONFIG);
        }
      },
      (error) => {
        console.warn("[siteConfigService] Listener de siteConfig retornou erro:", error);
        if (onError) onError(error);
        onUpdate(DEFAULT_PUBLIC_SITE_CONFIG);
      }
    );
  } catch (err: any) {
    console.warn("[siteConfigService] Falha ao iniciar listener de siteConfig:", err);
    if (onError) onError(err);
    onUpdate(DEFAULT_PUBLIC_SITE_CONFIG);
    return () => {};
  }
}

/**
 * Hook React para carregar e sincronizar a configuração do site em tempo real nos componentes públicos.
 */
export function useSiteConfig() {
  const [config, setConfig] = useState<PublicSiteConfig>(DEFAULT_PUBLIC_SITE_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicSiteConfig();
      setConfig(data);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar configurações");
      setConfig(DEFAULT_PUBLIC_SITE_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToPublicSiteConfig(
      (updated) => {
        if (isMounted) {
          setConfig(updated);
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    config,
    whatsappUrl: config.whatsappUrl || TEMPORARY_FALLBACK_WHATSAPP_URL,
    loading,
    error,
    refetch: fetchConfig,
  };
}
