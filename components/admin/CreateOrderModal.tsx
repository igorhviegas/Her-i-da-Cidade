import React, { FormEvent, useMemo, useState } from 'react';
import { createClient } from '../../services/clientsService';
import { createOrder } from '../../services/ordersService';
import { calculateOrderDeadlines } from '../../services/orderDates';
import { EventOrderFields } from './EventOrderFields';
import { emptyVideoAddons, ImportFormButton, VideoAddonsSection } from './EventVideoAddons';
import type { Order } from '../../types';
import { buildDeliveryOptions, computeTotal, dateFromInput, deriveServiceState, priceFromService } from './ordersFlow/createOrderHelpers';
import type { CreateOrderInitialValues } from './ordersFlow/createOrderHelpers';
import { buildCreateOrderInput, createVideoOrders, validateClientAndService, validateOrderDetails, validateVideoOrders } from './ordersFlow/createOrderSubmit';
import { ClientSection, CreateOrderError, CreateOrderFooter, CreateOrderHeader, OrderSection, ServiceSection, ValuesSection } from './ordersFlow/CreateOrderSections';
import { useClientFields, useOrderFields, useOrderServices } from './ordersFlow/useCreateOrderFields';

interface CreateOrderModalProps {
  onClose: () => void;
  /** `warning`: o evento foi criado, mas algum pedido de vídeo não (a mensagem diz qual). */
  onCreated: (order: Order, warning?: string) => Promise<void>;
  initialValues?: CreateOrderInitialValues;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onCreated, initialValues }) => {
  const { services, loadingServices, servicesError } = useOrderServices(initialValues);
  const [serviceId, setServiceId] = useState(initialValues?.serviceId || '');
  const clientFields = useClientFields(initialValues);
  const fields = useOrderFields(initialValues);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [videoAddons, setVideoAddons] = useState(emptyVideoAddons);
  const { name, whatsapp } = clientFields;
  const { paidDate, eventDate, deliveryDays, content, servicePrice, rushFee, totalPaid, eventState, setEventState, setServicePrice, setRushFee, setTotalPaid, setDeliveryDays } = fields;

  const selectedService = services.find((service) => service.id === serviceId);
  const { isEvent, serviceConfigured, initialStatus } = deriveServiceState(selectedService);
  const total = computeTotal(totalPaid, servicePrice, rushFee);
  const deadlinePreview = useMemo(() => {
    if (!paidDate || !deliveryDays) return null;
    try {
      return calculateOrderDeadlines(dateFromInput(paidDate), Number(deliveryDays));
    } catch {
      return null;
    }
  }, [paidDate, deliveryDays]);

  const handleServiceChange = (id: string) => {
    const service = services.find((item) => item.id === id);
    setServiceId(id);
    setServicePrice(service ? priceFromService(service.price) : '');
    setRushFee('0');
    setTotalPaid('');
    setDeliveryDays(service?.defaultDeliveryDays !== undefined ? String(service.defaultDeliveryDays) : '');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const basics = validateClientAndService({ name, whatsapp, selectedService, serviceConfigured, initialStatus, setFormError });
    if (!basics) return;
    const details = validateOrderDetails({ isEvent, eventState, paidDate, servicePrice, rushFee, content, deliveryDays, setFormError });
    if (!details) return;
    const videos = isEvent && details.eventValues ? validateVideoOrders({ addons: videoAddons, services, event: details.eventValues, setFormError }) : [];
    if (!videos) return;

    setSubmitting(true);
    try {
      // createClient usa transação e retorna o cadastro existente se o WhatsApp já estiver cadastrado.
      // Assim, mudanças locais no nome não alteram o cadastro de cliente existente.
      const client = await createClient({ name: basics.cleanName, whatsapp: whatsapp.trim() });
      const order = await createOrder(buildCreateOrderInput({ ...details, clientId: client.id, selectedService, initialStatus, eventDate, deliveryDays, content, totalPaid, initialValues }));
      // Os vídeos nascem depois do evento (principal): se algum falhar, o evento já existe, então avisamos em vez de reabrir o formulário.
      await onCreated(order, await createVideoOrders(videos, client.id, details.eventValues.eventDate));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar o pedido.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6" role="presentation">
      <button aria-label="Fechar formulário" className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="create-order-title" className="relative z-10 my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <CreateOrderHeader initialValues={initialValues} submitting={submitting} onClose={onClose} />

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            <CreateOrderError formError={formError} />
            <ClientSection client={clientFields} />
            <ServiceSection
              services={services}
              serviceId={serviceId}
              loadingServices={loadingServices}
              submitting={submitting}
              servicesError={servicesError}
              selectedService={selectedService}
              serviceConfigured={serviceConfigured}
              initialStatus={initialStatus}
              onServiceChange={handleServiceChange}
            />

            {isEvent ? (
              <>
                <ImportFormButton event={eventState} addons={videoAddons} clientName={name} disabled={submitting} onEvent={setEventState} onAddons={setVideoAddons} onClientName={clientFields.setName} />
                <EventOrderFields value={eventState} onChange={setEventState} disabled={submitting} />
                <VideoAddonsSection value={videoAddons} onChange={setVideoAddons} disabled={submitting} />
              </>
            ) : (
              <>
                <OrderSection fields={fields} selectedService={selectedService} deliveryOptions={buildDeliveryOptions(selectedService)} deadlinePreview={deadlinePreview} />
                <ValuesSection fields={fields} initialValues={initialValues} total={total} />
              </>
            )}
          </div>

          <CreateOrderFooter initialValues={initialValues} submitting={submitting} loadingServices={loadingServices} hasServices={services.length > 0} onClose={onClose} />
        </form>
      </div>
    </div>
  );
};
