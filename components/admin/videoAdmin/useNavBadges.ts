import { useState, useEffect } from 'react';
import { subscribeActiveOrders } from '../../../services/ordersService';
import { subscribeTodayMissionsCount } from '../../../services/missionsService';
import { subscribeToVideos } from '../../../services/videosService';
import type { NavBadge } from '../AdminNav';
import type { AdminTab } from './dashboardTypes';

export const useNavBadges = () => {
  // Contador do menu: pedidos em andamento (todas as etapas do Kanban, exceto Concluído), em tempo real e compartilhado com o widget da Principal.
  // null = ainda carregando ou indisponível (erro de conexão/permissão): nunca é exibido como zero.
  const [activeOrdersCount, setActiveOrdersCount] = useState<number | null>(null);
  const [ordersCountFailed, setOrdersCountFailed] = useState(false);
  useEffect(() => subscribeActiveOrders(
    (orders) => { setActiveOrdersCount(orders.length); setOrdersCountFailed(false); },
    () => { setActiveOrdersCount(null); setOrdersCountFailed(true); },
  ), []);

  // Contador "Missões": tarefas e to-dos com prazo para hoje ainda pendentes.
  const [todayMissionsCount, setTodayMissionsCount] = useState<number | null>(null);
  useEffect(() => subscribeTodayMissionsCount(setTodayMissionsCount), []);

  // Contador "Vídeos": importados do Instagram aguardando revisão (mesmo critério do filtro "Aguardando revisão").
  const [reviewVideosCount, setReviewVideosCount] = useState<number | null>(null);
  const [reviewVideosFailed, setReviewVideosFailed] = useState(false);
  useEffect(() => subscribeToVideos(
    (videos) => { setReviewVideosCount(videos.filter((v) => v.needsReview).length); setReviewVideosFailed(false); },
    () => { setReviewVideosCount(null); setReviewVideosFailed(true); },
    false,
  ), []);

  const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const navBadges: Partial<Record<AdminTab, NavBadge>> = {
    orders: { count: activeOrdersCount, failed: ordersCountFailed, label: (n) => `${plural(n, 'pedido', 'pedidos')} em andamento`, failedLabel: 'Não foi possível contar os pedidos em andamento' },
    missions: { count: todayMissionsCount, failed: false, label: (n) => `${plural(n, 'tarefa ou to-do', 'tarefas e to-dos')} para hoje`, failedLabel: '' },
    videos: { count: reviewVideosCount, failed: reviewVideosFailed, label: (n) => `${plural(n, 'vídeo', 'vídeos')} aguardando revisão`, failedLabel: 'Não foi possível contar os vídeos aguardando revisão' },
  };

  return navBadges;
};
