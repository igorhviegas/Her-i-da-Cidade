
export interface Service {
  id: string;
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  whatsappUrl: string;
  active?: boolean;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
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
  active: boolean;
  order: number;
  createdAt?: any;
  updatedAt?: any;
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
}

/**
 * Modelo de documento Firestore para configurações públicas do site ('siteConfig/public').
 */
export interface PublicSiteConfig {
  whatsappUrl: string;
  updatedAt?: any;
  [key: string]: any;
}

/**
 * Adaptador para converter documento do Firestore no formato legado consumido pelo frontend.
 */
export function adaptFirestoreServiceToLegacy(doc: FirestoreService): Service {
  return {
    id: doc.id,
    title: doc.name,
    price: doc.price,
    description: doc.shortDescription || doc.description,
    imageUrl: doc.image,
    category: doc.category || 'Geral'
  };
}

/**
 * Adaptador para converter serviço legado do constants.tsx para o formato estruturado do Firestore.
 */
export function adaptLegacyServiceToFirestore(legacy: Service, index: number): Omit<FirestoreService, 'id' | 'createdAt' | 'updatedAt'> {
  const slug = legacy.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    name: legacy.title,
    slug,
    shortDescription: legacy.description,
    description: legacy.description,
    price: legacy.price,
    image: legacy.imageUrl,
    category: legacy.category,
    active: true,
    order: index + 1
  };
}
