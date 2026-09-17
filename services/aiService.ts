
import { Review } from "../types";

export const fetchLiveReviews = async (): Promise<Review[]> => {
  try {
    const response = await fetch("/api/reviews");
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (error) {
    console.error("Erro ao buscar avaliações do servidor:", error);
  }

  // Fallback seguro caso a requisição falhe
  return [
    {
      id: 'f1',
      author: 'Camila Mendonça',
      rating: 5,
      comment: 'Incrível! O Homem-Aranha mandou um vídeo super personalizado para o meu filho. A qualidade é de cinema!',
      avatar: 'https://i.pravatar.cc/150?u=camila'
    },
    {
      id: 'f2',
      author: 'Marcos Vinícius',
      rating: 5,
      comment: 'O melhor serviço de heróis que já contratei. Pontualidade e uma atuação impecável.',
      avatar: 'https://i.pravatar.cc/150?u=marcos'
    },
    {
      id: 'f3',
      author: 'Juliana Duarte',
      rating: 5,
      comment: 'Experiência mágica! Meu filho não acreditou quando viu o herói entrando na festa. Valeu cada centavo!',
      avatar: 'https://i.pravatar.cc/150?u=juliana'
    }
  ];
};
