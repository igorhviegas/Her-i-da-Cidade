import type { Timestamp } from 'firebase/firestore';

export type HomeSectionType =
  | 'hero'
  | 'services'
  | 'video-teaser'
  | 'about'
  | 'booking'
  | 'testimonials'
  | 'text'
  | 'promotional'
  | 'cta'
  | 'image-text';

export interface HomeSection {
  id: string;
  internalName: string;
  sectionType: HomeSectionType;
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  active: boolean;
  order: number;
  startAt?: Timestamp | Date | null;
  endAt?: Timestamp | Date | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface HomeSeo {
  seoTitle: string;
  seoDescription: string;
}

export interface HomeContent extends HomeSeo {
  sections: HomeSection[];
}

export type HomeSectionInput = Omit<HomeSection, 'id' | 'createdAt' | 'updatedAt'>;
