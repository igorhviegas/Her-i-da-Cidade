import { useEffect, useMemo, useState } from 'react';
import { validateEventForm } from '../../../services/eventForm.js';
import { planAdjustments } from '../../../services/eventFinance.js';
import { getServices } from '../../../services/servicesService';
import type { Client, Order, Service } from '../../../types';
import { eventFormFromOrder } from '../EventOrderFields';
import { formatMoney } from './createOrderHelpers';
import { dateInput } from './editOrderHelpers';

/** Campos editáveis do pedido, iniciados com os valores atuais. */
export const useEditOrderFields = (order: Order, client: Client | null | undefined) => {
  const [name, setName] = useState(client?.name || '');
  const [whatsapp, setWhatsapp] = useState(client?.whatsapp || '');
  const [serviceId, setServiceId] = useState(order.serviceId);
  const [paidDate, setPaidDate] = useState(dateInput(order.paidAt));
  const [eventDate, setEventDate] = useState(dateInput(order.eventDate));
  const [deliveryDays, setDeliveryDays] = useState(order.deliveryDays === undefined ? '' : String(order.deliveryDays));
  const [content, setContent] = useState(order.content || '');
  const [servicePrice, setServicePrice] = useState(String(order.servicePrice ?? ''));
  const [rushFee, setRushFee] = useState(String(order.rushFee ?? 0));
  const [totalPaid, setTotalPaid] = useState(String(order.totalPaid ?? ''));
  const [eventState, setEventState] = useState(() => eventFormFromOrder(order));

  return { name, setName, whatsapp, setWhatsapp, serviceId, setServiceId, paidDate, setPaidDate, eventDate, setEventDate, deliveryDays, setDeliveryDays, content, setContent, servicePrice, setServicePrice, rushFee, setRushFee, totalPaid, setTotalPaid, eventState, setEventState };
};

/** Lista de serviços (inclui inativos e o serviço atual do pedido, se ele não vier na lista). */
export const useEditOrderServices = (order: Order, service: Service | null | undefined) => {
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getServices({ onlyActive: false, fallbackOnError: false })
      .then((items) => {
        if (!cancelled) {
          const available = items.some((item) => item.id === order.serviceId) || !service
            ? items
            : [...items, service];
          setServices(available);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os serviços.');
      })
      .finally(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, [order.serviceId, service]);

  return { services, loadingServices, error, setError };
};

/** Ajustes que o salvamento geraria no Financeiro, para eventos que já têm lançamentos. */
export const useEventAdjustment = (order: Order, eventState: ReturnType<typeof eventFormFromOrder>, isDraft: boolean) => {
  const signed = (value: number) => `${value > 0 ? '+' : '−'} ${formatMoney(Math.abs(value))}`;
  // Ajustes que este salvamento geraria no Financeiro (só para eventos com lançamentos; mesma regra que o servidor aplica).
  const adjustment = useMemo(() => {
    if (isDraft || !order.eventLedger) return null;
    const parsed = validateEventForm(eventState).value;
    if (!parsed) return null;
    const plan = planAdjustments(order.id, order, parsed, null);
    return plan.records.length ? plan : null;
  }, [eventState, order, isDraft]);
  const describeAdjustment = () => (adjustment?.records ?? []).map((r) => `${r.type === 'revenue' ? 'Receita' : 'Despesa evento'}: ${signed(r.amount)}`).join(' · ');

  return { adjustment, describeAdjustment };
};
