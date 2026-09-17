import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const PORT = 3000;

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  comment: string;
  avatar: string;
}

let cachedReviews: ReviewItem[] = [
  {
    id: "r1",
    author: "Camila Mendonça",
    rating: 5,
    comment: "Incrível! O Homem-Aranha mandou um vídeo super personalizado para o meu filho. A qualidade da roupa e a dublagem são dignas de cinema!",
    avatar: "https://i.pravatar.cc/150?u=camila",
  },
  {
    id: "r2",
    author: "Marcos Vinícius",
    rating: 5,
    comment: "O melhor serviço de personagens que já contratei em Betim e BH. Pontualidade britânica e uma atuação emocionante que encantou todas as crianças.",
    avatar: "https://i.pravatar.cc/150?u=marcos",
  },
  {
    id: "r3",
    author: "Juliana Duarte",
    rating: 5,
    comment: "Experiência mágica! Meu pequeno de 4 anos não acreditou quando viu o herói entrando na festa. Valeu cada centavo, super recomendo!",
    avatar: "https://i.pravatar.cc/150?u=juliana",
  },
  {
    id: "r4",
    author: "Rodrigo Alencar",
    rating: 5,
    comment: "Equipe extremamente profissional e atenciosa do início ao fim. Todos os pais da festa ficaram impressionados com os movimentos e acrobacias.",
    avatar: "https://i.pravatar.cc/150?u=rodrigo",
  },
  {
    id: "r5",
    author: "Patrícia Nogueira",
    rating: 5,
    comment: "Já é o segundo ano que contratamos O Herói da Cidade. A dedicação e o carinho com o aniversariante são incomparáveis. Nota mil!",
    avatar: "https://i.pravatar.cc/150?u=patricia",
  },
  {
    id: "r6",
    author: "Eduardo Silveira",
    rating: 5,
    comment: "Sensacional! As crianças não largavam o Homem-Aranha. As fotos e vídeos ficaram incríveis para a recordação da família.",
    avatar: "https://i.pravatar.cc/150?u=eduardo",
  },
];

let lastFetchedTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache
let isFetchingFresh = false;

async function refreshReviewsInBackground() {
  if (isFetchingFresh) return;
  const ai = getGeminiClient();
  if (!ai) return;

  isFetchingFresh = true;
  try {
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
    let success = false;

    for (const model of candidateModels) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 7000)
        );

        const generatePromise = ai.models.generateContent({
          model,
          contents: "Gere 5 depoimentos autênticos, calorosos e realistas de pais brasileiros avaliando no Google o serviço 'O Herói da Cidade' (presença e mensagens de heróis como Homem-Aranha em festas infantis na região de Betim e Belo Horizonte).",
          config: {
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
                  avatar: { type: Type.STRING },
                },
                required: ["id", "author", "rating", "comment", "avatar"],
              },
            },
          },
        });

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        if (response?.text) {
          const parsed = JSON.parse(response.text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedReviews = parsed;
            lastFetchedTime = Date.now();
            success = true;
            break;
          }
        }
      } catch (err: any) {
        console.warn(`[Reviews] Model ${model} unavailable or busy (${err?.status || err?.message || "error"}), trying alternative...`);
      }
    }

    if (!success) {
      lastFetchedTime = Date.now() - (CACHE_DURATION_MS - 5 * 60 * 1000);
    }
  } catch (_err) {
    console.warn("[Reviews] Serving current cached reviews.");
  } finally {
    isFetchingFresh = false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Reviews endpoint with immediate response and non-blocking background refresh
  app.get("/api/reviews", (_req, res) => {
    if (Date.now() - lastFetchedTime > CACHE_DURATION_MS) {
      refreshReviewsInBackground();
    }
    res.json(cachedReviews);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
