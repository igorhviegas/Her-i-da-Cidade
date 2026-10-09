
/** Dúvida pública de um serviço (categoria + resposta), exibida em /duvidas/{slug}. */
export interface ServiceFaqItem {
  id: string;
  title: string;
  content: string;
}

export interface Service {
  id: string;
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  whatsappUrl: string;
  whatsappUrlSource?: 'auto' | 'manual';
  badgeText?: string;
  active?: boolean;
  order?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  generateOrder?: boolean;
  productionType?: ProductionType;
  initialStatus?: OrderStatus;
  autoComplete?: boolean;
  defaultDeliveryDays?: number;
  /** Mensagem de WhatsApp do botão de envio do Kanban; ausente/vazia = padrão do tipo de serviço. */
  deliveryMessage?: string;
  internalOnly?: boolean;
  /** Dúvidas públicas, na ordem de exibição. */
  faq?: ServiceFaqItem[];
}

export type ProductionType = 'scheduled' | 'recording' | 'editing' | 'immediate';
export type OrderStatus = 'scheduled' | 'recording' | 'editing' | 'delivery' | 'completed';
export type OrderSource = 'manual' | 'manychat' | 'booking';

/** Cliente interno do CRM. whatsappNormalized é a chave lógica de busca. */
export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  whatsappNormalized: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type FirestoreClient = Client;

/** Snapshot operacional e financeiro do pedido; preços são os praticados na venda. */
export interface Order {
  id: string;
  /** Legacy sequential number retained on older orders; new orders omit it. */
  orderNumber?: number;
  orderNumberDisplay?: string;
  /** Legacy ManyChat field; newly received orders use the document ID as this value. */
  technicalPurchaseId?: string;
  clientId: string;
  serviceId: string;
  status: OrderStatus;
  createdAt?: unknown;
  paidAt?: unknown;
  eventDate?: unknown;
  content: string;
  deliveryDays?: number;
  customerDueDate?: unknown;
  internalDueDate?: unknown;
  servicePrice: number;
  rushFee: number;
  totalPaid: number;
  productionType: ProductionType;
  completedAt?: unknown;
  source: OrderSource;
  scriptId?: string;
  /** Legado: impressão digital de PDF importado (importação removida; mantido para não perder dados de pedidos antigos). */
  importFingerprint?: string;
  /** Nome do aniversariante (pedidos de evento criados pelo formulário manual); lido por extractBirthdayPerson. */
  childName?: string;
  /** Dados do formulário manual de evento. Ausente em pedidos antigos / ManyChat. */
  eventForm?: EventForm;
  /** Pedido presencial criado pelo ManyChat só com cliente e WhatsApp: os dados do evento ainda não foram preenchidos. Sai ao salvar o formulário de evento. */
  eventDraft?: boolean;
  /** Pré-agendamento de Vídeo Chamada feito pelo site: o horário está reservado, mas o pagamento ainda não foi confirmado (sai quando o ManyChat confirma o pagamento). */
  paymentPending?: boolean;
  /** Dados do agendamento público de Vídeo Chamada (/agendar-chamada). `date`/`time` são o horário local da agenda. */
  videoCall?: { date: string; time: string; durationMinutes: number; slotId: string; childAge: string; theme: string; details: string; /** Momento da reserva (ms); conta o prazo de pagamento. */ bookedAtMs?: number; /** WhatsApp de contato em formato internacional, só dígitos (DDI + número). */ whatsapp?: string; /** Código do país (DDI) e número nacional do contato, como informados. */ ddi?: string; phone?: string; /** Número que recebe a chamada, quando não é o de contato. */ callWhatsapp?: string; email?: string; /** Fuso do cliente (identificador IANA detectado no navegador); a agenda é sempre a de Brasília. */ timezone?: string };
  /** Presente em pedidos de evento com livro de lançamentos (collection financeEntries). Valores já lançados (congelados). */
  eventLedger?: { entry: number; final?: number; cost?: number; /** soma dos ajustes de receita */ adj?: number; /** soma dos ajustes de despesa */ adjCost?: number; /** nº do último ajuste */ seq?: number };
  /** Vínculo com o Google Agenda, gravado pelo servidor (/api/google-calendar). */
  googleCalendar?: { eventId: string; calendarId: string; htmlLink?: string; syncedAt?: unknown };
  /** Mudanças de etapa do Kanban, gravadas por updateOrder desde a introdução do recurso (pedidos mais antigos não têm). Base do tempo parado por etapa. */
  stageHistory?: { from: OrderStatus; to: OrderStatus; at: unknown }[];
  /** Custo de edição (R$) gravado na primeira conclusão de Vídeo Personalizado; entra nas despesas do Financeiro. */
  editingCost?: number;
}

export interface EventForm {
  eventTime: string;
  location: string;
  imageAuthorization: boolean;
  extraWeb: 0 | 1 | 2;
  totalValue: number;
  entryValue: number;
  /** null = ainda não informado; obrigatório só para concluir o pedido. */
  cost: number | null;
  observations: string;
  /** "#formulário": tipo/identificação do evento; compõe o título no Google Agenda. */
  formType: string;
}

export type FirestoreOrder = Order;

export type ScriptProductionStatus = 'draft' | 'ready' | 'in_production' | 'produced';
export type ScriptPublicationStatus = 'unpublished' | 'published';

/** Material permanente da biblioteca; status não determina remoção ou vínculo com pedido. */
export interface ContentScript {
  id: string;
  title: string;
  content: string;
  category: string;
  productionStatus: ScriptProductionStatus;
  publicationStatus: ScriptPublicationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
  /** Primeira vez que o roteiro ficou Pronto para gravar; definido uma só vez. */
  readyAt?: unknown;
  notes: string;
  /** Pedido de produção associado a este roteiro, quando enviado. */
  orderId?: string;
  /** Reservado para rastrear futuramente o roteiro de origem. */
  sourceScriptId?: string;
  /** ID de outro documento contentScripts; ausente identifica um roteiro principal. */
  parentScriptId?: string;
}

/**
 * Modelo oficial de documento no Firestore para a coleção 'services'.
 */
export interface FirestoreService {
  id: string;
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  whatsappUrl: string;
  whatsappUrlSource?: 'auto' | 'manual'; // ausente em documentos antigos
  badgeText?: string;
  active: boolean;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  generateOrder?: boolean;
  productionType?: ProductionType;
  initialStatus?: OrderStatus;
  autoComplete?: boolean;
  defaultDeliveryDays?: number;
  deliveryMessage?: string;
  internalOnly?: boolean;
  faq?: ServiceFaqItem[];
}

/**
 * Modelo de documento no Firestore para a coleção 'admins'.
 */
export interface AdminUser {
  uid: string;
  email: string;
  role: 'superadmin' | 'admin' | 'editor';
  active: boolean;
  createdAt: string;
  displayName?: string;
}

/**
 * Modelo de documento no Firestore para a coleção 'videos' (Catálogo futuro).
 */
export interface FirestoreVideo {
  id: string;
  title: string;
  instagramUrl: string;
  instagramId?: string;
  caption?: string;
  description?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  category?: string;
  categories: string[];
  tags: string[];
  topics: string[];
  ageRange?: string;
  keywords: string[];
  searchText?: string;
  publishedAt?: string;
  active: boolean;
  featured?: boolean;
  badgeText?: string;
  /** Criado pela sincronização do Instagram e ainda não revisado pelo administrador. */
  needsReview?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface utilizada nas camadas de UI para representar um vídeo.
 */
export interface Video {
  id: string;
  title: string;
  instagramUrl: string;
  instagramId?: string;
  caption?: string;
  description?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  category?: string;
  categories: string[];
  tags: string[];
  topics: string[];
  ageRange?: string;
  keywords: string[];
  searchText?: string;
  publishedAt?: string;
  active: boolean;
  featured?: boolean;
  badgeText?: string;
  /** Importado do Instagram e ainda não revisado (mapDocToVideo só preenche quando true). */
  needsReview?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  avatar: string;
  /** Texto relativo do Google ("2 meses atrás"). */
  when?: string;
}

/**
 * Modelo de documento Firestore para configurações públicas do site ('siteConfig/public').
 */
export interface PublicSiteConfig {
  whatsappUrl: string;
  updatedAt?: unknown;
  [key: string]: unknown;
}
