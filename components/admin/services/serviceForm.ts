import type { Service, OrderStatus, ProductionType, ServiceFaqItem } from '../../../types';
import type { CreateServiceInput, UpdateServiceInput } from '../../../services/servicesService';

export interface ServiceFormData {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  order: number;
  active: boolean;
  badgeText: string;
  generateOrder: boolean;
  productionType: ProductionType | '';
  initialStatus: OrderStatus | '';
  autoComplete: boolean;
  defaultDeliveryDays: string;
  deliveryMessage: string;
  faq: ServiceFaqItem[];
}

export type ServiceFormErrors = Partial<Record<keyof ServiceFormData, string>>;

export const DEFAULT_CATEGORIES = [
  'Pronta entrega',
  'Ao Vivo',
  'Exclusivo',
  'Presencial'
];

export const emptyServiceForm = (order: number): ServiceFormData => ({
  title: '',
  price: '',
  description: '',
  imageUrl: '',
  category: 'Pronta entrega',
  order,
  active: true,
  badgeText: '',
  generateOrder: false,
  productionType: '',
  initialStatus: '',
  autoComplete: false,
  defaultDeliveryDays: '',
  deliveryMessage: '',
  faq: [],
});

export const serviceToFormData = (service: Service): ServiceFormData => ({
  title: service.title,
  price: service.price,
  description: service.description,
  imageUrl: service.imageUrl,
  category: service.category,
  order: service.order ?? 1,
  active: service.active !== false,
  badgeText: service.badgeText ?? '',
  generateOrder: service.generateOrder ?? false,
  productionType: service.productionType ?? '',
  initialStatus: service.initialStatus ?? '',
  autoComplete: service.autoComplete ?? false,
  defaultDeliveryDays: service.defaultDeliveryDays !== undefined ? String(service.defaultDeliveryDays) : '',
  deliveryMessage: service.deliveryMessage ?? '',
  faq: service.faq ?? [],
});

export const validateServiceForm = (formData: ServiceFormData, hasPendingImage: boolean): ServiceFormErrors => {
  const errors: ServiceFormErrors = {};

  if (!formData.title.trim()) {
    errors.title = 'O nome do serviço é obrigatório.';
  }
  if (!formData.price.trim()) {
    errors.price = 'O preço do serviço é obrigatório (ex: Apenas R$ 35, Sob Consulta).';
  }
  if (!formData.description.trim()) {
    errors.description = 'A descrição do serviço é obrigatória.';
  }
  if (!formData.category.trim()) {
    errors.category = 'A categoria é obrigatória.';
  }
  if (hasPendingImage) {
    errors.imageUrl = 'Envie a imagem selecionada antes de salvar o serviço.';
  } else if (!formData.imageUrl.trim()) {
    errors.imageUrl = 'A URL da imagem é obrigatória.';
  } else if (!formData.imageUrl.startsWith('http://') && !formData.imageUrl.startsWith('https://')) {
    errors.imageUrl = 'Informe uma URL válida iniciada por https:// ou http://';
  }
  if (typeof formData.order !== 'number' || isNaN(formData.order) || formData.order < 1) {
    errors.order = 'A ordem de exibição deve ser um número maior que zero.';
  }
  // Categoria de dúvida pela metade seria descartada em silêncio ao salvar; itens totalmente vazios são ignorados.
  if (formData.faq.some((item) => Boolean(item.title.trim()) !== Boolean(item.content.trim()))) {
    errors.faq = 'Preencha o título e o conteúdo de cada categoria de dúvida (ou remova a categoria vazia).';
  }

  return errors;
};

/** Mensagem de erro da configuração de pedido; string vazia quando válida. */
export const getOrderConfigError = (formData: ServiceFormData): string => {
  if (!formData.generateOrder) return '';
  if (!formData.productionType || !formData.initialStatus) {
    return 'Selecione o tipo de produção e o status inicial para habilitar pedidos no CRM.';
  }
  if (formData.defaultDeliveryDays && (!/^\d+$/.test(formData.defaultDeliveryDays) || Number(formData.defaultDeliveryDays) < 1)) {
    return 'O prazo deve ser um número inteiro positivo de dias corridos ou ficar vazio.';
  }
  return '';
};

export const buildUpdatePayload = (formData: ServiceFormData, orderConfigTouched: boolean): UpdateServiceInput => ({
  title: formData.title,
  price: formData.price,
  description: formData.description,
  imageUrl: formData.imageUrl,
  category: formData.category,
  order: formData.order,
  active: formData.active,
  badgeText: formData.badgeText,
  deliveryMessage: formData.deliveryMessage,
  faq: formData.faq,
  ...(orderConfigTouched ? {
    generateOrder: formData.generateOrder,
    productionType: formData.productionType || null,
    initialStatus: formData.initialStatus || null,
    autoComplete: formData.autoComplete,
    defaultDeliveryDays: formData.defaultDeliveryDays ? Number(formData.defaultDeliveryDays) : null,
  } : {}),
});

export const buildCreatePayload = (formData: ServiceFormData, orderConfigTouched: boolean): CreateServiceInput => ({
  title: formData.title,
  price: formData.price,
  description: formData.description,
  imageUrl: formData.imageUrl,
  category: formData.category,
  order: formData.order,
  active: formData.active,
  badgeText: formData.badgeText,
  deliveryMessage: formData.deliveryMessage,
  faq: formData.faq,
  ...(orderConfigTouched ? {
    generateOrder: formData.generateOrder,
    ...(formData.productionType ? { productionType: formData.productionType } : {}),
    ...(formData.initialStatus ? { initialStatus: formData.initialStatus } : {}),
    autoComplete: formData.autoComplete,
    ...(formData.defaultDeliveryDays ? { defaultDeliveryDays: Number(formData.defaultDeliveryDays) } : {}),
  } : {}),
});

/** Traduz o erro do Firestore (JSON de permissão ou mensagem simples) para o feedback exibido. */
export const describeSaveError = (err: { message?: string } | null | undefined): string => {
  let errorMsg = 'Falha ao salvar o serviço. Verifique suas permissões de administrador.';
  if (err?.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.error) {
        errorMsg = `Falha de permissão (${parsed.operationType}): ${parsed.error}`;
      }
    } catch {
      errorMsg = err.message;
    }
  }
  return errorMsg;
};
