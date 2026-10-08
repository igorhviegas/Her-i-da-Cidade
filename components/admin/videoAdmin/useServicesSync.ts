import { useState, useEffect } from 'react';
import { logger } from '../../../lib/logger.js';
import { getServices, seedServicesIfEmpty } from '../../../services/servicesService';

export const useServicesSync = () => {
  // Estado da sincronização dos serviços
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const checkAndSyncServices = async (auto = false) => {
    try {
      if (!auto) setIsSyncing(true);
      const currentList = await getServices();
      setServicesCount(currentList.length);

      // Se ainda não houver nenhum serviço no Firestore, executa o seed seguro
      if (currentList.length === 0) {
        const result = await seedServicesIfEmpty();
        const updated = await getServices();
        setServicesCount(updated.length);
        if (!auto) {
          setSyncFeedback({
            type: 'success',
            message: result.message,
          });
        }
      } else if (!auto) {
        setSyncFeedback({
          type: 'success',
          message: `${currentList.length} serviços já sincronizados no Firestore. Nenhuma duplicata criada.`,
        });
      }
    } catch (err) {
      logger.error('[AdminDashboard] Erro ao sincronizar serviços:', err);
      if (!auto) {
        setSyncFeedback({
          type: 'error',
          message: 'Falha ao sincronizar serviços no Firestore. Verifique as permissões de administrador.',
        });
      }
    } finally {
      if (!auto) setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkAndSyncServices(true);
  }, []);

  return { servicesCount, isSyncing, syncFeedback, checkAndSyncServices };
};
