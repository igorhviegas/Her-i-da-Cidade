import { logger } from '../../../lib/logger.js';
import React, { useState } from 'react';
import { createService, updateService } from '../../../services/servicesService';
import { Service } from '../../../types';
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
} from '../services/serviceForm';
import { useServiceImageUpload } from '../services/useServiceImageUpload';
import type { ShowFeedback } from './useServicesAdmin';

interface ServiceFormModalInput {
  services: Service[];
  showFeedback: ShowFeedback;
}

/** Modal de criação / edição de serviço: estado do formulário, validações e envio. */
export function useServiceFormModal({ services, showFeedback }: ServiceFormModalInput) {
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
    } catch (err) {
      logger.error('[AdminServices] Erro ao salvar serviço:', err);
      showFeedback('error', describeSaveError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isFormModalOpen, setIsFormModalOpen, editingServiceId, isCustomCategory, setIsCustomCategory, formData, setFormData, formErrors,
    orderConfigError, isSubmitting, image, handleOpenCreateModal, handleOpenEditModal, handleOrderConfigChange, handleSubmitService,
  };
}
