import { logger } from '../../lib/logger.js';
import React, { useState, useMemo } from 'react';
import {
  useServices,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  updateServiceOrder,
} from '../../services/servicesService';
import { Service } from '../../types';
import {
  type ServiceFormData,
  type ServiceFormErrors,
  emptyServiceForm,
  serviceToFormData,
  validateServiceForm,
  getOrderConfigError,
  buildCreatePayload,
  buildUpdatePayload,
  describeSaveError,
  DEFAULT_CATEGORIES,
} from './services/serviceForm';
import { useServiceImageUpload } from './services/useServiceImageUpload';
import { ServicesToolbar, type ServiceFeedback, type ServiceStatusFilter } from './services/ServicesToolbar';
import { ServicesError, ServicesLoading, ServicesEmpty } from './services/ServicesListStates';
import { ServicesTable } from './services/ServicesTable';
import { ServiceCards } from './services/ServiceCards';
import { ServiceFormModal } from './services/ServiceFormModal';
import { DeleteServiceModal } from './services/DeleteServiceModal';

export const AdminServices: React.FC = () => {
  // Busca todos os serviços (ativos e inativos) com sincronização em tempo real
  const { services, loading, error, refetch } = useServices({
    onlyActive: false,
    realTime: true,
  });

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ServiceStatusFilter>('all');

  // Modal de Criação / Edição
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>(emptyServiceForm(1));
  const [formErrors, setFormErrors] = useState<ServiceFormErrors>({});
  const [orderConfigTouched, setOrderConfigTouched] = useState(false);
  const [orderConfigError, setOrderConfigError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const image = useServiceImageUpload((imageUrl) => {
    setFormData((current) => ({ ...current, imageUrl }));
    setFormErrors((current) => ({ ...current, imageUrl: undefined }));
  });

  // Modal de Confirmação de Exclusão
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de feedback / notificação
  const [feedback, setFeedback] = useState<ServiceFeedback>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 4500);
  };

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

  // Abertura do formulário (criação ou edição)
  const openFormModal = (data: ServiceFormData, serviceId: string | null, customCategory: boolean) => {
    setEditingServiceId(serviceId);
    setIsCustomCategory(customCategory);
    setFormData(data);
    setFormErrors({});
    setOrderConfigTouched(false);
    setOrderConfigError('');
    image.clear();
    image.setComplete(false);
    setIsFormModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    const nextOrder = services.reduce((max, s) => Math.max(max, s.order ?? 0), 0) + 1;
    openFormModal(emptyServiceForm(nextOrder), null, false);
  };

  const handleOpenEditModal = (service: Service) => {
    openFormModal(serviceToFormData(service), service.id, !DEFAULT_CATEGORIES.includes(service.category));
  };

  // Qualquer edição da configuração de pedido marca o bloco como "tocado" e limpa o erro
  const handleOrderConfigChange = (patch: Partial<ServiceFormData>) => {
    setOrderConfigTouched(true);
    setOrderConfigError('');
    setFormData({ ...formData, ...patch });
  };

  // Validação do formulário
  const validateForm = (): boolean => {
    const errors = validateServiceForm(formData, Boolean(image.selectedImage));
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateOrderConfiguration = (): boolean => {
    const message = getOrderConfigError(formData);
    setOrderConfigError(message);
    return message === '';
  };

  // Salvar serviço (Criação ou Edição)
  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (image.isUploading || !validateForm() || !validateOrderConfiguration()) return;

    setIsSubmitting(true);
    try {
      if (editingServiceId) {
        await updateService(editingServiceId, buildUpdatePayload(formData, orderConfigTouched));
        showFeedback('success', `Serviço "${formData.title}" atualizado com sucesso! Alterações já visíveis no site.`);
      } else {
        await createService(buildCreatePayload(formData, orderConfigTouched));
        showFeedback('success', `Novo serviço "${formData.title}" cadastrado com sucesso!`);
      }

      setIsFormModalOpen(false);
      setEditingServiceId(null);
    } catch (err: any) {
      logger.error('[AdminServices] Erro ao salvar serviço:', err);
      showFeedback('error', describeSaveError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar status ativo/inativo
  const handleToggleStatus = async (service: Service) => {
    const newStatus = !service.active;
    try {
      await toggleServiceStatus(service.id, service.active !== false);
      showFeedback(
        'success',
        `Serviço "${service.title}" ${newStatus ? 'ativado e publicado no site' : 'desativado (ocultado do site público)'}.`
      );
    } catch (err: any) {
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
    } catch (err: any) {
      logger.error('[AdminServices] Erro ao alterar ordem:', err);
      showFeedback('error', 'Falha ao reordenar o serviço.');
    }
  };

  // Excluir serviço após confirmação
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteService(serviceToDelete.id);
      showFeedback('success', `Serviço "${serviceToDelete.title}" excluído com sucesso.`);
      setServiceToDelete(null);
    } catch (err: any) {
      logger.error('[AdminServices] Erro ao excluir serviço:', err);
      showFeedback('error', 'Falha ao excluir o serviço. Verifique suas permissões.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <ServicesToolbar
        services={services}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
        feedback={feedback}
        setFeedback={setFeedback}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        handleOpenCreateModal={handleOpenCreateModal}
      />

      {error && <ServicesError error={error} refetch={refetch} />}

      {loading && !error && <ServicesLoading />}

      {!loading && !error && filteredServices.length === 0 && (
        <ServicesEmpty
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          setSearchTerm={setSearchTerm}
          setFilterStatus={setFilterStatus}
          handleOpenCreateModal={handleOpenCreateModal}
        />
      )}

      {!loading && !error && filteredServices.length > 0 && (
        <>
          <ServicesTable
            filteredServices={filteredServices}
            handleQuickOrderChange={handleQuickOrderChange}
            handleToggleStatus={handleToggleStatus}
            handleOpenEditModal={handleOpenEditModal}
            setServiceToDelete={setServiceToDelete}
          />
          <ServiceCards
            filteredServices={filteredServices}
            handleQuickOrderChange={handleQuickOrderChange}
            handleToggleStatus={handleToggleStatus}
            handleOpenEditModal={handleOpenEditModal}
            setServiceToDelete={setServiceToDelete}
          />
        </>
      )}

      {isFormModalOpen && (
        <ServiceFormModal
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          editingServiceId={editingServiceId}
          isCustomCategory={isCustomCategory}
          setIsCustomCategory={setIsCustomCategory}
          isSubmitting={isSubmitting}
          image={image}
          orderConfigError={orderConfigError}
          handleOrderConfigChange={handleOrderConfigChange}
          setIsFormModalOpen={setIsFormModalOpen}
          handleSubmitService={handleSubmitService}
        />
      )}

      {serviceToDelete && (
        <DeleteServiceModal
          serviceToDelete={serviceToDelete}
          isDeleting={isDeleting}
          setServiceToDelete={setServiceToDelete}
          handleConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
};
