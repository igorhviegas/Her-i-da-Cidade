import { useMemo, useState } from 'react';
import { extractBirthdayPerson } from '../../../services/orderReference.js';
import type { OrderView } from '../orders/orderView';

/** Busca do topo da página e as listas filtradas (andamento e concluídos). */
export const useOrdersFilters = (orders: OrderView[], completedOrders: OrderView[]) => {
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return orders.filter(({ client, service, script }) => !term ||
      (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (service?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (script?.title || '').toLocaleLowerCase('pt-BR').includes(term));
  }, [orders, search]);

  const filteredCompletedOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return completedOrders.filter(({ order, client, service, script }) => {
      const birthday = extractBirthdayPerson(order);
      return !term ||
        (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (service?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (script?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (birthday || '').toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [completedOrders, search]);

  return { search, setSearch, filteredOrders, filteredCompletedOrders };
};
