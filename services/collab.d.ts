export type CollabStatus = 'prospect' | 'contacted' | 'form' | 'approved' | 'producing' | 'review' | 'published' | 'closed' | 'cancelled';
export type ReelStatus = '' | 'received' | 'changes' | 'approved' | 'rejected';
export type CouponWarning = 'unknown' | 'expired' | 'not_started' | 'cancelled' | 'event';
export type CriterionId = 'followers' | 'maternity' | 'childAge' | 'follows' | 'openProfile';

export interface CollabChild { name: string; age: string }
export interface CollabGrant { serviceId: string; orderId: string; at: string }

/** Documento de collabPartners. Datas da parceria em 'AAAA-MM-DD' (Brasília); '' = não informada. */
export interface CollabPartner {
  id: string;
  name: string;
  instagram: string;
  whatsapp: string;
  /** DDI + número, só dígitos (wa.me); '' quando ainda não informado. */
  whatsappNormalized: string;
  city: string;
  children: CollabChild[];
  contentType: string;
  status: CollabStatus;
  criteria: Partial<Record<CriterionId, boolean>>;
  /** 'A' = a criadora publica e convida; 'B' = o Herói da Cidade publica e convida. */
  publicationModel: '' | 'A' | 'B';
  theme: string;
  briefingUrl: string;
  conditionsAt: string;
  reelStatus: ReelStatus;
  reelUrl: string;
  reelPublishedAt: string;
  storiesAt: string;
  couponCode: string;
  grants: CollabGrant[];
  notes: string;
  /** Aceite do formulário público (termo em minuta). */
  terms: { version: string; acceptedAtMs: number; childImage: boolean } | null;
  source: 'form' | 'manual';
  formAtMs: number | null;
}

/** Gravado no pedido quando o pagamento chega com cupom (`orders.collab`). */
export interface OrderCollab { code: string; partnerId: string | null; discount: number; commission: number; warning?: CouponWarning; reviewed?: boolean }
export interface CommissionSale { orderId: string; partnerId: string; code: string; serviceId: string; day: string; weekKey: string; commission: number }
export interface CollabPayout { id: string; partnerId: string; weekKey: string; orderIds: string[]; amount: number }

export const PARTNERS: string;
export const PAYOUTS: string;
export const CONFIG_PATH: [string, string];
export const FORM_PATH: string;
export const COLLAB_DISCOUNT: number;
export const COLLAB_COMMISSION: number;
export const COUPON_DAYS: number;
export const PRODUCTION_DAYS: number;
export const KEEP_DAYS: number;
export const EXPIRING_DAYS: number;
export const STATUSES: Array<[CollabStatus, string]>;
export const REEL_STATUSES: Array<[ReelStatus, string]>;
export const CRITERIA: Array<[CriterionId, string]>;
export const PROJECT_THEMES: string[];
export const GRANT_SERVICES: Array<{ serviceId: string; label: string; limit: number }>;
export const WARNING_LABELS: Record<CouponWarning, string>;
export const MAX_CHILDREN: number;
export const TERMS_VERSION: string;
export const TERMS_SECTIONS: Array<{ title: string; items: string[] }>;

export function statusLabel(id: string): string;
export function brDate(key: string): string;
export function money(value: number): string;
export function normalizeCouponCode(value: unknown): string;
export function normalizeInstagram(value: unknown): string;
export function partnerDeadlines(partner: Partial<CollabPartner> | null | undefined): { productionDue: string; couponUntil: string; keepUntil: string };
export function couponState(partner: Partial<CollabPartner> | null | undefined, today: string): { state: 'none' | 'waiting' | 'active' | 'expired'; until: string; daysLeft: number | null };
export function couponBoard<T extends Partial<CollabPartner> & { name: string }>(partners: T[], today: string): Array<{ partner: T; state: 'waiting' | 'active' | 'expired'; until: string; daysLeft: number | null }>;
export function couponAttribution(code: string, partner: (Partial<CollabPartner> & { id: string }) | null, today: string, pricing: string): OrderCollab;
export function discountedPrice(price: number, discount: number): number;
export function weekStartOf(key: string): string;
export function weekLabel(weekKey: string): string;
export function payoutId(partnerId: string, weekKey: string): string;
export function commissionSales(orders: Array<{ id: string; status?: string; serviceId?: string; completedAt?: unknown; paidAt?: unknown; collab?: OrderCollab }>): CommissionSale[];
export function weeklyCommissions(sales: CommissionSale[], payouts: Array<Pick<CollabPayout, 'weekKey' | 'orderIds'>>, weekKey: string): Array<{ partnerId: string; pending: CommissionSale[]; paid: CommissionSale[]; pendingTotal: number; paidTotal: number }>;
export function weeklyReportMessage(input: { name: string; code: string; weekKey: string; sales: Array<Pick<CommissionSale, 'day' | 'serviceId' | 'commission'>>; serviceName: (serviceId: string) => string }): string;
export function whatsappLink(whatsappNormalized: string, message: string): string | null;
export function quotaLimits(saved: { limits?: Record<string, unknown> } | null | undefined): Record<string, number>;
export function quotaUsage<T extends { grants?: CollabGrant[] }>(partners: T[], limits: Record<string, number>): Array<{ serviceId: string; label: string; limit: number; granted: number; remaining: number; holders: Array<{ partner: T; grant: CollabGrant }> }>;

export interface CollabFormValues { name: string; instagram: string; whatsapp: string; ddi: string; city: string; children: CollabChild[]; contentType: string; acceptTerms: boolean; childImage: '' | 'yes' | 'no' }
export interface CollabForm { name: string; instagram: string; whatsapp: string; ddi: string; city: string; children: CollabChild[]; contentType: string; acceptTerms: boolean; childImage: boolean | null }
export function validateCollabForm(input: unknown): { errors: string[] | null; fields: Array<keyof CollabFormValues>; form: CollabForm };
