
import React from 'react';
import { Service, Review } from './types';

export const SERVICES: Service[] = [
  {
    id: '1',
    title: 'Vídeo Especial de Aniversário',
    price: 'Apenas R$ 30',
    description: 'Uma mensagem do herói da cidade para o aniversariante do dia.',
    imageUrl: 'https://strict-bronze-c9lmqpt5fv.edgeone.app/Anivers%C3%A1rio.jpeg',
    category: 'Pronta entrega'
  },
  {
    id: '2',
    title: 'Vídeo Chamada ao Vivo',
    price: '15 minutos R$ 75',
    description: 'Interação em tempo real com o herói, direto da nossa base secreta.',
    imageUrl: 'https://eerie-chocolate-cuzaxle2lt.edgeone.app/Chamada.jpeg',
    category: 'Ao Vivo'
  },
  {
    id: '3',
    title: 'Vídeo Personalizado',
    price: 'A partir de R$ 60',
    description: 'Roteiro exclusivo para situações especiais: bom comportamento, escola, etc.',
    imageUrl: 'https://young-blush-amffe0wipw.edgeone.app/Personalizado.jpeg',
    category: 'Exclusivo'
  },
  {
    id: '4',
    title: 'Vídeo Convite',
    price: 'A partir de R$ 65',
    description: 'Convite animado e épico para sua festa de aniversário temática.',
    imageUrl: 'https://wooden-chocolate-e7hrhsuhzk.edgeone.app/Convite.jpeg',
    category: 'Exclusivo'
  },
  {
    id: '5',
    title: 'Vídeo Temático',
    price: 'Apenas R$ 20',
    description: 'Coloque o nome da sua criança nos vídeos do instagram.',
    imageUrl: 'https://sunny-amethyst-y7zbexuydq.edgeone.app/Tem%C3%A1tico.jpeg',
    category: 'Pronta Entrega'
  },
  {
    id: '6',
    title: 'Serviços Presenciais',
    price: 'Sob Consulta',
    description: 'Visitas reais em festas e eventos corporativos na sua cidade.',
    imageUrl: 'https://grateful-bronze-9xbpmjgfbs.edgeone.app/Presencial.jpeg',
    category: 'Presencial'
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
