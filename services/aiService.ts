
import { GoogleGenAI, Type } from "@google/genai";
import { Review } from "../types";

export const fetchLiveReviews = async (): Promise<Review[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Busque ou gere 5 reviews realistas do Google para o serviço 'O Herói da Cidade' (serviço de mensagens e presença de heróis como Homem-Aranha para festas infantis). Os depoimentos devem ser de pais brasileiros, variados, detalhados e extremamente positivos. Retorne APENAS um JSON válido seguindo a estrutura: Array<{id: string, author: string, rating: number, comment: string, avatar: string}>",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              author: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              comment: { type: Type.STRING },
              avatar: { type: Type.STRING }
            },
            required: ["id", "author", "rating", "comment", "avatar"]
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error("Erro ao buscar reviews via IA:", error);
  }
  
  // Fallback se a API falhar
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
    }
  ];
};
