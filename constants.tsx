
import React from 'react';
import { Service, Review } from './types';

/**
 * SERVIÇOS PADRÃO (FALLBACK TEMPORÁRIO DE MIGRAÇÃO):
 * 
 * ATENÇÃO: A fonte oficial e primária dos serviços agora é a coleção 'services'
 * no Firebase Cloud Firestore, consumida através da camada 'services/servicesService.ts'.
 * 
 * Este array é mantido temporariamente apenas como garantia de integridade visual
 * e resiliência caso o Firestore esteja inacessível ou em processo de sincronização inicial.
 */
export const SERVICES: Service[] = [
  {
    id: '1',
    title: 'Vídeo Especial de Aniversário',
    price: 'Apenas R$ 30',
    description: 'Uma mensagem do herói da cidade para o aniversariante do dia.',
    imageUrl: 'https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg',
    category: 'Pronta entrega',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Especial%20de%20Anivers%C3%A1rio'
  },
  {
    id: '2',
    title: 'Vídeo Chamada ao Vivo',
    price: '15 minutos R$ 75',
    description: 'Interação em tempo real com o herói, direto da nossa base secreta.',
    imageUrl: 'https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg',
    category: 'Ao Vivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Chamada%20ao%20Vivo'
  },
  {
    id: '3',
    title: 'Vídeo Personalizado',
    price: 'A partir de R$ 60',
    description: 'Roteiro exclusivo para situações especiais: bom comportamento, escola, etc.',
    imageUrl: 'https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg',
    category: 'Exclusivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Personalizado'
  },
  {
    id: '4',
    title: 'Vídeo Convite',
    price: 'A partir de R$ 65',
    description: 'Convite animado e épico para sua festa de aniversário temática.',
    imageUrl: 'https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg',
    category: 'Exclusivo',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Convite'
  },
  {
    id: '5',
    title: 'Vídeo Temático',
    price: 'Apenas R$ 20',
    description: 'Coloque o nome da sua criança nos vídeos do instagram.',
    imageUrl: 'https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg',
    category: 'Pronta Entrega',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20V%C3%ADdeo%20Tem%C3%A1tico'
  },
  {
    id: '6',
    title: 'Serviços Presenciais',
    price: 'Sob Consulta',
    description: 'Visitas reais em festas e eventos corporativos na sua cidade.',
    imageUrl: 'https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg',
    category: 'Presencial',
    whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20servi%C3%A7os%20do%20Heroi%20da%20Cidade!%20Tenho%20interesse%20no%20servi%C3%A7o%3A%20Servi%C3%A7os%20Presenciais'
  }
];

export const REVIEWS: Review[] = [
  {
    id: '1',
    author: 'Mariana Silva',
    rating: 5,
    comment: 'O vídeo de aniversário foi o ponto alto da festa do meu filho! Ele ficou em choque vendo o herói chamando pelo nome dele.',
    avatar: 'https://i.pravatar.cc/150?u=mariana'
  },
  {
    id: '2',
    author: 'Ricardo Oliveira',
    rating: 5,
    comment: 'Serviço impecável. A vídeo chamada foi super natural e o ator muito atencioso com as crianças.',
    avatar: 'https://i.pravatar.cc/150?u=ricardo'
  },
  {
    id: '3',
    author: 'Juliana Costa',
    rating: 5,
    comment: 'O convite personalizado fez todo mundo querer ir na festa! Super indico o Herói da Cidade.',
    avatar: 'https://i.pravatar.cc/150?u=juliana'
  },
  {
    id: '4',
    author: 'Pedro Santos',
    rating: 4,
    comment: 'Muito boa a qualidade do vídeo e do áudio. Entrega rápida também.',
    avatar: 'https://i.pravatar.cc/150?u=pedro'
  }
];

export const COLORS = {
  primary: '#0B1929',
  secondary: '#E50914',
  accent: '#A855F7', // Purple
  white: '#FFFFFF',
};
