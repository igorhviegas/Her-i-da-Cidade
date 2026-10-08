import React, { FormEvent, useState } from 'react';
import { updateOrder } from '../../services/ordersService';
import { EventOrderFields } from './EventOrderFields';
import type { Client, Order, Service } from '../../types';
import { EditClientSection, EditOrderError, EditOrderFooter, EditOrderHeader, EditOrderNotices, EditOrderSection, EditValuesSection } from './ordersFlow/EditOrderSections';
import { buildEventUpdates, buildOrderUpdates, buildUpdatedOrder, computeEditChanges, resolveUpdatedClient, validateEditBasics, validateEditNumbers, validateEditWhatsApp } from './ordersFlow/editOrderSubmit';
import { useEditOrderFields, useEditOrderServices, useEventAdjustment } from './ordersFlow/useEditOrderFields';

interface EditOrderModalProps {
  order: Order;
  client: Client | null | undefined;
  service: Service | null | undefined;
  onClose: () => void;
  onSaved: (order: Order, client: Client, service: Service) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, client, service, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const { services, loadingServices, error, setError } = useEditOrderServices(order, service);
  const fields = useEditOrderFields(order, client);
  const { name, whatsapp, serviceId, paidDate, eventDate, deliveryDays, content, servicePrice, rushFee, totalPaid, eventState, setEventState } = fields;
  // Pedido criado pelo formulário manual de evento: edita os campos do evento (os lançamentos já feitos no Financeiro não mudam).
  const isDraft = order.eventDraft === true; // criado pelo ManyChat: só cliente e WhatsApp até este cadastro
  const isEventOrder = Boolean(order.eventForm) || isDraft;
  const { adjustment, describeAdjustment } = useEventAdjustment(order, eventState, isDraft);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const basics = validateEditBasics({ name, isEventOrder, eventState, paidDate, serviceId, services, service, setError });
    if (!basics) return;
    const contact = validateEditWhatsApp(whatsapp, setError);
    if (!contact) return;
    const numbers = validateEditNumbers({ deliveryDays, servicePrice, rushFee, totalPaid, content, setError });
    if (!numbers) return;

    if (adjustment && !window.confirm(`Salvar vai lançar no Financeiro, na data de hoje: ${describeAdjustment()}.\nOs lançamentos anteriores continuam como estão (histórico preservado). Confirmar?`)) return;
    setSaving(true);
    try {
      const updatedClient = await resolveUpdatedClient({ client, cleanName: basics.cleanName, whatsapp, normalizedWhatsApp: contact.normalizedWhatsApp });
      const saveContext = {
        order, updatedClient, selectedService: basics.selectedService, eventValues: basics.eventValidation?.value, isEventOrder, isDraft, adjustment, paidDate, eventDate, deliveryDays, content, ...numbers,
      };
      const changes = computeEditChanges(saveContext);
      const eventUpdates = buildEventUpdates(saveContext.eventValues);
      await updateOrder(order.id, buildOrderUpdates(saveContext, changes, eventUpdates));
      onSaved(buildUpdatedOrder(saveContext, changes, eventUpdates), updatedClient, basics.selectedService);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as alterações do pedido.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-order-title" className="my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <EditOrderHeader saving={saving} onClose={onClose} />
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            <EditOrderError error={error} />
            <EditClientSection fields={fields} saving={saving} />
            <EditOrderNotices order={order} isDraft={isDraft} isEventOrder={isEventOrder} adjustment={adjustment} describeAdjustment={describeAdjustment} />
            {isEventOrder ? <EventOrderFields value={eventState} onChange={setEventState} disabled={saving} /> : (
              <>
                <EditOrderSection fields={fields} services={services} loadingServices={loadingServices} saving={saving} />
                <EditValuesSection fields={fields} saving={saving} />
              </>
            )}
          </div>
          <EditOrderFooter saving={saving} loadingServices={loadingServices} hasServices={services.length > 0} onClose={onClose} />
        </form>
      </section>
    </div>
  );
};
