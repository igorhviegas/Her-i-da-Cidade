import { logger } from '../../../lib/logger.js';
import { useMemo, useState } from 'react';
import { deleteService, toggleServiceStatus, updateServiceOrder } from '../../../services/servicesService';
import { Service } from '../../../types';
import type { ServiceFeedback, ServiceStatusFilter } from '../services/ServicesToolbar';

export type ShowFeedback = (type: 'success' | 'error', message: string) => void;

/** Estado de feedback / notificação (some sozinho depois de 4,5 s). */
export function useServiceFeedback() {
  const [feedback, setFeedback] = useState<ServiceFeedback>(null);

  const showFeedback: ShowFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  return { feedback, setFeedback, showFeedback };
}

/** Busca, filtro de status e contagens para os badges. */
export function useServiceFilters(services: Service[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ServiceStatusFilter>('all');

  // Filtragem e busca no frontend
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.price.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'active') return service.active !== false;
      if (filterStatus === 'inactive') return service.active === false;
      return true;
    });
  }, [services, searchTerm, filterStatus]);

  // Contagens para os badges
  const activeCount = useMemo(() => services.filter((s) => s.active !== false).length, [services]);
  const inactiveCount = useMemo(() => services.filter((s) => s.active === false).length, [services]);

  return { searchTerm, setSearchTerm, filterStatus, setFilterStatus, filteredServices, activeCount, inactiveCount };
}

/** Modal de confirmação de exclusão. */
export function useServiceDelete(showFeedback: ShowFeedback) {
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excluir serviço após confirmação
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteService(serviceToDelete.id);
      showFeedback('success', `Serviço "${serviceToDelete.title}" excluído com sucesso.`);
      setServiceToDelete(null);
    } catch (err) {
      logger.error('[AdminServices] Erro ao excluir serviço:', err);
      showFeedback('error', 'Falha ao excluir o serviço. Verifique suas permissões.');
    } finally {
      setIsDeleting(false);
    }
  };

  return { serviceToDelete, setServiceToDelete, isDeleting, handleConfirmDelete };
}

/** Ações rápidas de cada linha: ativar/desativar e ajustar a ordem. */
export function useServiceRowActions(showFeedback: ShowFeedback) {
  // Alternar status ativo/inativo
  const handleToggleStatus = async (service: Service) => {
    const newStatus = !service.active;
    try {
      await toggleServiceStatus(service.id, service.active !== false);
      showFeedback(
        'success',
        `Serviço "${service.title}" ${newStatus ? 'ativado e publicado no site' : 'desativado (ocultado do site público)'}.`
      );
    } catch (err) {
      logger.error('[AdminServices] Erro ao alterar status:', err);
      showFeedback('error', 'Não foi possível alterar o status do serviço.');
    }
  };

  // Ajustar ordem rápida (+1 ou -1)
  const handleQuickOrderChange = async (service: Service, delta: number) => {
    const currentOrder = service.order ?? 1;
    const newOrder = Math.max(1, currentOrder + delta);
    if (newOrder === currentOrder) return;

    try {
      await updateServiceOrder(service.id, newOrder);
      showFeedback('success', `Ordem do serviço "${service.title}" ajustada para ${newOrder}.`);
    } catch (err) {
      logger.error('[AdminServices] Erro ao alterar ordem:', err);
      showFeedback('error', 'Falha ao reordenar o serviço.');
    }
  };

  return { handleToggleStatus, handleQuickOrderChange };
}
