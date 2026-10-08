import { useState, useEffect, useCallback } from "react";
import { SERVICES as FALLBACK_SERVICES } from "../../constants";
import { getServices, subscribeToServices } from "./serviceQueries";
import type { ServicesState } from "./serviceInputs";

/**
 * Estratégia de estado de carregamento (Loading State Strategy):
 * Hook React que encapsula:
 * - Carregamento inicial (loading: true -> loading: false)
 * - Tratamento de erros detalhado (error: string | null)
 * - Sincronização em tempo real opcional
 * - Função manual de recarga (refetch)
 */
export function useServices(hookOptions: {
  onlyActive?: boolean;
  realTime?: boolean;
} = {}) {
  const { onlyActive = true, realTime = true } = hookOptions;

  const [state, setState] = useState<ServicesState>({
    services: [],
    loading: true,
    error: null,
  });

  const fetchServicesData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getServices({ onlyActive });
      setState({
        services: data,
        loading: false,
        error: null,
      });
    } catch (err) {
      const errorMsg = err?.message || "Não foi possível carregar os serviços.";
      setState({
        services: FALLBACK_SERVICES,
        loading: false,
        error: errorMsg,
      });
    }
  }, [onlyActive]);

  useEffect(() => {
    let isMounted = true;

    if (!realTime) {
      fetchServicesData();
      return () => {
        isMounted = false;
      };
    }

    // Estratégia com listener em tempo real
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = subscribeToServices(
      (updatedServices) => {
        if (isMounted) {
          setState({
            services: updatedServices,
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            services: prev.services.length > 0 ? prev.services : FALLBACK_SERVICES,
            loading: false,
            error: err?.message || "Erro na sincronização em tempo real.",
          }));
        }
      },
      { onlyActive }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [realTime, onlyActive, fetchServicesData]);

  return {
    services: state.services,
    loading: state.loading,
    error: state.error,
    refetch: fetchServicesData,
  };
}
