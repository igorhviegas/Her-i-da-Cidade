import { Service, ServiceFaqItem, OrderStatus, ProductionType } from "../../types";

/**
 * Opções de configuração para busca de serviços.
 */
export interface ServiceFetchOptions {
  /** Se deve buscar apenas serviços marcados como ativos. Padrão: false */
  onlyActive?: boolean;
  /** Se deve retornar os dados de fallback em caso de erro. Padrão: true */
  fallbackOnError?: boolean;
}

export interface CreateServiceInput {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  /** Opcional: se omitido, é gerado a partir do número padrão configurado em /admin. */
  whatsappUrl?: string;
  active?: boolean;
  order?: number;
  badgeText?: string;
  generateOrder?: boolean;
  productionType?: ProductionType;
  initialStatus?: OrderStatus;
  autoComplete?: boolean;
  defaultDeliveryDays?: number;
  deliveryMessage?: string;
  faq?: ServiceFaqItem[];
}

export interface UpdateServiceInput {
  title?: string;
  price?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  whatsappUrl?: string;
  active?: boolean;
  order?: number;
  badgeText?: string;
  generateOrder?: boolean;
  productionType?: ProductionType | null;
  initialStatus?: OrderStatus | null;
  autoComplete?: boolean;
  defaultDeliveryDays?: number | null;
  /** Vazio/null remove a personalização (volta ao padrão do tipo de serviço). */
  deliveryMessage?: string | null;
  /** Substitui a lista inteira; lista vazia (ou só com itens incompletos) remove o campo. */
  faq?: ServiceFaqItem[];
}

/**
 * Interface que representa o estado de carregamento e dados dos serviços.
 */
export interface ServicesState {
  services: Service[];
  loading: boolean;
  error: string | null;
}
