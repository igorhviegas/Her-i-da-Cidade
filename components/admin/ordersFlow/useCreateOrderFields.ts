import { useEffect, useState } from 'react';
import { getClientByWhatsApp, normalizeWhatsApp } from '../../../services/clientsService';
import { getServices } from '../../../services/servicesService';
import type { Service } from '../../../types';
import { emptyEventForm, eventFormFromOrder } from '../EventOrderFields';
import type { EventFormState } from '../EventOrderFields';
import { dateInput } from './createOrderHelpers';
import type { CreateOrderInitialValues } from './createOrderHelpers';

/** Carrega os serviços (só ativos, exceto ao duplicar um pedido). */
export const useOrderServices = (initialValues: CreateOrderInitialValues | undefined) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getServices({ onlyActive: !initialValues, fallbackOnError: false })
      .then((items) => { if (!cancelled) setServices(items); })
      .catch((error) => { if (!cancelled) setServicesError(error instanceof Error ? error.message : 'Não foi possível carregar os serviços.'); })
      .finally(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, [initialValues]);

  return { services, loadingServices, servicesError };
};

/** Nome e WhatsApp do cliente, com a verificação de cadastro existente ao sair do campo. */
export const useClientFields = (initialValues: CreateOrderInitialValues | undefined) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [whatsapp, setWhatsapp] = useState(initialValues?.whatsapp || '');
  const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'new' | 'error'>('idle');
  const [lookupMessage, setLookupMessage] = useState('');

  const handleWhatsAppBlur = async () => {
    if (!whatsapp.trim()) {
      setLookupState('idle');
      setLookupMessage('');
      return;
    }
    try {
      const normalized = normalizeWhatsApp(whatsapp);
      if (!/^55\d{10,11}$/.test(normalized)) throw new Error('Informe um WhatsApp válido com DDD.');
      setLookupState('checking');
      setLookupMessage('Verificando cliente…');
      const existing = await getClientByWhatsApp(whatsapp);
      if (existing) {
        setName(existing.name);
        setLookupState('found');
        setLookupMessage('Cliente já cadastrado. O pedido usará este cadastro.');
      } else {
        setLookupState('new');
        setLookupMessage(`Novo cliente · WhatsApp normalizado: ${normalized}`);
      }
    } catch (error) {
      setLookupState('error');
      setLookupMessage(error instanceof Error ? error.message : 'Não foi possível verificar este WhatsApp.');
    }
  };

  return { name, setName, whatsapp, setWhatsapp, lookupState, setLookupState, lookupMessage, setLookupMessage, handleWhatsAppBlur };
};

/** Datas, prazo, conteúdo, valores e formulário de evento do pedido. */
export const useOrderFields = (initialValues: CreateOrderInitialValues | undefined) => {
  const [paidDate, setPaidDate] = useState('');
  const [eventDate, setEventDate] = useState(dateInput(initialValues?.eventDate));
  const [deliveryDays, setDeliveryDays] = useState(initialValues?.deliveryDays === undefined ? '' : String(initialValues.deliveryDays));
  const [content, setContent] = useState(initialValues?.content || '');
  const [servicePrice, setServicePrice] = useState(initialValues ? String(initialValues.servicePrice) : '');
  const [rushFee, setRushFee] = useState(initialValues ? String(initialValues.rushFee) : '0');
  const [totalPaid, setTotalPaid] = useState(initialValues ? String(initialValues.totalPaid) : '');
  const [eventState, setEventState] = useState<EventFormState>(() => (initialValues?.eventForm
    ? eventFormFromOrder({ eventForm: initialValues.eventForm, childName: initialValues.childName, eventDate: initialValues.eventDate })
    : emptyEventForm()));

  return { paidDate, setPaidDate, eventDate, setEventDate, deliveryDays, setDeliveryDays, content, setContent, servicePrice, setServicePrice, rushFee, setRushFee, totalPaid, setTotalPaid, eventState, setEventState };
};
