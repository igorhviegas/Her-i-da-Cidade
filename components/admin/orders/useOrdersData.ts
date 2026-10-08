import { useCallback, useEffect, useState } from 'react';
import { getClientById } from '../../../services/clientsService';
import { listOrders } from '../../../services/ordersService';
import { getContentScriptsByIds } from '../../../services/contentScriptsService';
import { getServiceById } from '../../../services/servicesService';
import type { OrderView } from './orderView';

export const useOrdersData = () => {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderView[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const allOrders = await listOrders();
      setTotalOrderCount(allOrders.length);
      const clientIds = [...new Set(allOrders.map((order) => order.clientId).filter(Boolean))];
      const serviceIds = [...new Set(allOrders.map((order) => order.serviceId).filter(Boolean))];
      const scriptIds = [...new Set(allOrders.map((order) => order.scriptId).filter((id): id is string => Boolean(id)))];
      const [clients, services, scripts] = await Promise.all([
        Promise.all(clientIds.map((id) => getClientById(id))),
        Promise.all(serviceIds.map((id) => getServiceById(id))),
        getContentScriptsByIds(scriptIds),
      ]);
      const clientsById = new Map(clientIds.map((id, index) => [id, clients[index]]));
      const servicesById = new Map(serviceIds.map((id, index) => [id, services[index]]));
      const scriptsById = new Map(scripts.map((script) => [script.id, script]));
      const allOrderViews = allOrders.map((order) => ({
        order,
        client: clientsById.get(order.clientId),
        service: servicesById.get(order.serviceId),
        script: order.scriptId ? scriptsById.get(order.scriptId) || null : null,
      }));
      setOrders(allOrderViews.filter(({ order }) => order.status !== 'completed'));
      setCompletedOrders(allOrderViews.filter(({ order }) => order.status === 'completed'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  return { orders, setOrders, completedOrders, setCompletedOrders, totalOrderCount, setTotalOrderCount, loading, error, loadOrders };
};
