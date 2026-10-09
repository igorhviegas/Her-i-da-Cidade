import { logger } from './lib/logger.js';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { handleThumbnailUpload } from "./api/upload-thumbnail";
import { handleAgentAudioUpload } from "./api/upload-agent-audio";
import { handleKartPdfUpload } from "./functions/kart-pdf-upload.js";
import { handleManyChatWebhook } from "./api/manychat";
import { handleMissionsCron } from "./api/missions-cron";
import { handleAlexa } from "./api/alexa";
import { handleInstagramSync } from "./api/instagram-sync";
import { handleGoogleCalendar } from "./api/google-calendar";
import { handleCalendarEvents } from "./api/calendar-events";
import { handleVideoCall } from "./api/video-call";
import { handleTravelRoute } from "./api/travel-route";
import { handleFitIngest } from "./api/fit-ingest";
import { handleReviews } from "./api/reviews";

const PORT = 3000;

async function startServer() {
  const app = express();
  // rawBody: a assinatura da Alexa é verificada sobre os bytes exatos da requisição.
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Avaliações reais do Google (docs/avaliacoes.md)
  app.all("/api/reviews", (req, res) => {
    handleReviews(req, res);
  });

  // Vercel Blob Thumbnail Upload endpoint
  app.all("/api/upload-thumbnail", (req, res) => {
    handleThumbnailUpload(req, res);
  });

  // Upload de áudio do /agente-hdc (administrador autenticado)
  app.all("/api/upload-agent-audio", (req, res) => {
    handleAgentAudioUpload(req, res);
  });

  // Upload do PDF original das corridas do /kart (administrador autenticado)
  app.all("/api/upload-kart-pdf", (req, res) => {
    handleKartPdfUpload(req, res);
  });

  // ManyChat Webhook endpoint
  app.all("/api/manychat", (req, res) => {
    handleManyChatWebhook(req, res);
  });

  // Missions daily sync (Vercel Cron in production; manual call with CRON_SECRET locally)
  app.all("/api/missions-cron", (req, res) => {
    handleMissionsCron(req, res);
  });

  // Alexa Skill: cria missões a partir de lembretes por voz
  app.all("/api/instagram-sync", (req, res) => {
    handleInstagramSync(req, res);
  });

  // Google Agenda: envio manual de pedidos de evento (administrador autenticado)
  app.all("/api/google-calendar", (req, res) => {
    handleGoogleCalendar(req, res);
  });

  // Calendário: listar/criar/editar/excluir eventos da agenda (administrador autenticado)
  app.all("/api/calendar-events", (req, res) => {
    handleCalendarEvents(req, res);
  });

  // Agendamento público de Vídeo Chamada (sem login): horários livres e pré-reserva
  app.all("/api/video-call", (req, res) => {
    handleVideoCall(req, res);
  });

  // Deslocamento dos eventos (área do agente; exige código de acesso): km por trecho via Google Maps
  app.all("/api/travel-route", (req, res) => {
    handleTravelRoute(req, res);
  });

  // Fit: totais diários do Apple Saúde enviados pelo Atalho do iPhone (segredo FIT_INGEST_TOKEN)
  app.all("/api/fit-ingest", (req, res) => {
    handleFitIngest(req, res);
  });

  app.all("/api/alexa", (req, res) => {
    handleAlexa(req, res);
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
    logger.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
