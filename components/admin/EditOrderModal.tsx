import React, { FormEvent, useState } from 'react';
import { updateOrder } from '../../services/ordersService';
import { sendOrderToGoogleCalendar } from '../../services/googleCalendarService';
import { EventOrderFields } from './EventOrderFields';
import { emptyVideoAddons, ImportFormButton, VideoAddonsSection } from './EventVideoAddons';
import type { Client, Order, Service } from '../../types';
import { EditClientSection, EditOrderError, EditOrderFooter, EditOrderHeader, EditOrderNotices, EditOrderSection, EditValuesSection } from './ordersFlow/EditOrderSections';
import { createVideoOrders, validateVideoOrders } from './ordersFlow/createOrderSubmit';
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
  // Formulário do site: os vídeos pedidos pelo cliente já vêm marcados até virarem pedidos (videosCreated).
  const [videoAddons, setVideoAddons] = useState(() => {
    const site = order.eventFormSite?.videosCreated ? undefined : order.eventFormSite?.videos;
    if (!site) return emptyVideoAddons();
    const inviteDetails = [site.inviteParents && `Pais: ${site.inviteParents}`, site.inviteDetails].filter(Boolean).join('. ');
    return {
      ...emptyVideoAddons(), birthday: site.birthday, birthdayName: site.birthdayName, invite: site.invite, inviteName: site.invite ? order.childName ?? '' : '',
      inviteAge: (site.childAge ?? '').replace(/\D/g, ''), inviteTime: site.inviteGuestTime ?? '', inviteDetails,
    };
  });
  const { services, loadingServices, error, setError } = useEditOrderServices(order, service);
  const fields = useEditOrderFields(order, client);
  const { name, whatsapp, serviceId, paidDate, eventDate, deliveryDays, content, servicePrice, rushFee, totalPaid, eventState, setEventState } = fields;
  // Pedido criado pelo formulário manual de evento: edita os campos do evento (os lançamentos já feitos no Financeiro não mudam).
  const isDraft = order.eventDraft === true; // criado pelo ManyChat: só cliente e WhatsApp até este cadastro
  const isEventOrder = Boolean(order.eventForm) || isDraft;
  const { adjustment, describeAdjustment } = useEventAdjustment(order, eventState, isDraft);
  // Formulário do site aguardando o sinal: salvar só guarda os dados; "Já recebi o sinal" confirma a reserva (entrada no Financeiro).
  const awaitingDeposit = isDraft && Boolean(order.eventFormSite) && order.paymentPending === true;
  const [depositReceived, setDepositReceived] = useState(false);
  const holding = awaitingDeposit && !depositReceived;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const basics = validateEditBasics({ name, isEventOrder, eventState, paidDate, serviceId, services, service, setError });
    if (!basics) return;
    const contact = validateEditWhatsApp(whatsapp, setError);
    if (!contact) return;
    const numbers = validateEditNumbers({ deliveryDays, servicePrice, rushFee, totalPaid, content, setError });
    if (!numbers) return;
    const eventValues = basics.eventValidation?.value;
    // Enquanto aguarda o sinal, os vídeos ficam só marcados (viram pedidos na confirmação, uma vez).
    const videos = eventValues && !holding ? validateVideoOrders({ addons: videoAddons, services, event: eventValues, setFormError: setError }) : [];
    if (!videos) return;

    if (adjustment && !window.confirm(`Salvar vai lançar no Financeiro, na data de hoje: ${describeAdjustment()}.\nOs lançamentos anteriores continuam como estão (histórico preservado). Confirmar?`)) return;
    setSaving(true);
    try {
      const updatedClient = await resolveUpdatedClient({ client, cleanName: basics.cleanName, whatsapp, normalizedWhatsApp: contact.normalizedWhatsApp });
      const saveContext = {
        order, updatedClient, selectedService: basics.selectedService, eventValues: basics.eventValidation?.value, isEventOrder, isDraft: isDraft && !holding, adjustment, paidDate, eventDate, deliveryDays, content, ...numbers,
      };
      const changes = computeEditChanges(saveContext);
      const eventUpdates = buildEventUpdates(saveContext.eventValues);
      await updateOrder(order.id, {
        ...buildOrderUpdates(saveContext, changes, eventUpdates),
        ...(awaitingDeposit && depositReceived ? { confirmDeposit: true } : {}),
        // Caminho de campo do Firestore: marca só este item de eventFormSite.
        ...(order.eventFormSite && videos.length ? { 'eventFormSite.videosCreated': true } as Record<string, unknown> : {}),
      });
      const warning = eventValues ? await createVideoOrders(videos, updatedClient.id, eventValues.eventDate) : undefined;
      // Formulário do site confirmado: o evento da agenda deixa de mostrar "(aguardando sinal)" e recebe os dados conferidos.
      const calendarWarning = isDraft && order.eventFormSite
        ? await sendOrderToGoogleCalendar(order.id).then(() => undefined, (calendarError: Error) => `Pedido salvo, mas a agenda não foi atualizada: ${calendarError.message} Use "Enviar para Google Agenda".`)
        : undefined;
      onSaved(buildUpdatedOrder(saveContext, changes, eventUpdates), updatedClient, basics.selectedService);
      if (warning || calendarWarning) window.alert([warning, calendarWarning].filter(Boolean).join('\n\n'));
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
            {isEventOrder ? (
              <>
                <ImportFormButton event={eventState} addons={videoAddons} disabled={saving} onEvent={setEventState} onAddons={setVideoAddons} />
                <EventOrderFields value={eventState} onChange={setEventState} disabled={saving} />
                <VideoAddonsSection value={videoAddons} onChange={setVideoAddons} disabled={saving} />
                {awaitingDeposit && (
                  <label className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                    <input type="checkbox" checked={depositReceived} onChange={(e) => setDepositReceived(e.target.checked)} disabled={saving} className="mt-0.5 h-4 w-4 accent-emerald-500" />
                    <span><strong>Já recebi o sinal</strong> (fora do ManyChat). Marque só com o pagamento em mãos: salvar confirma a reserva, lança a entrada no Financeiro e cria os pedidos dos vídeos. Sem marcar, salvar só guarda os dados.</span>
                  </label>
                )}
              </>
            ) : (
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
