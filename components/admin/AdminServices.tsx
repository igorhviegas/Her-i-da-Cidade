import React from 'react';
import { useServices } from '../../services/servicesService';
import { ServicesToolbar } from './services/ServicesToolbar';
import { ServicesError, ServicesLoading, ServicesEmpty } from './services/ServicesListStates';
import { ServicesTable } from './services/ServicesTable';
import { ServiceCards } from './services/ServiceCards';
import { ServiceFormModal } from './services/ServiceFormModal';
import { DeleteServiceModal } from './services/DeleteServiceModal';
import { useServiceDelete, useServiceFeedback, useServiceFilters, useServiceRowActions } from './adminPages/useServicesAdmin';
import { useServiceFormModal } from './adminPages/useServiceFormModal';

export const AdminServices: React.FC = () => {
  // Busca todos os serviços (ativos e inativos) com sincronização em tempo real
  const { services, loading, error, refetch } = useServices({
    onlyActive: false,
    realTime: true,
  });

  const { feedback, setFeedback, showFeedback } = useServiceFeedback();
  const { searchTerm, setSearchTerm, filterStatus, setFilterStatus, filteredServices, activeCount, inactiveCount } = useServiceFilters(services);
  const {
    isFormModalOpen, setIsFormModalOpen, editingServiceId, isCustomCategory, setIsCustomCategory, formData, setFormData, formErrors,
    orderConfigError, isSubmitting, image, handleOpenCreateModal, handleOpenEditModal, handleOrderConfigChange, handleSubmitService,
  } = useServiceFormModal({ services, showFeedback });
  const { serviceToDelete, setServiceToDelete, isDeleting, handleConfirmDelete } = useServiceDelete(showFeedback);
  const { handleToggleStatus, handleQuickOrderChange } = useServiceRowActions(showFeedback);

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
