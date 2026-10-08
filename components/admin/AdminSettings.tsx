import { logger } from '../../lib/logger.js';
import React, { useState, useEffect } from 'react';
import { 
  getPublicSiteConfig, 
  updatePublicSiteConfig, 
  isValidWhatsAppUrl, 
  TEMPORARY_FALLBACK_WHATSAPP_URL 
} from '../../services/siteConfigService';
import { syncAutoServiceWhatsAppUrls } from '../../services/servicesService';
import { SecurityNote, SettingsFeedback, SettingsHeader, WhatsAppCard } from './adminPages/SettingsParts';

// Acompanha o novo número nos serviços com link automático (manuais/antigos não são tocados).
async function syncServiceLinks(): Promise<string> {
  let syncNote = '';
  try {
    const { changed } = await syncAutoServiceWhatsAppUrls();
    if (changed > 0) syncNote = ` ${changed} serviço(s) com link automático foram atualizados.`;
  } catch (syncErr) {
    syncNote = ` Atenção: o número foi salvo, mas os links dos serviços não foram atualizados: ${syncErr?.message || 'erro desconhecido'}`;
  }
  return syncNote;
}

export const AdminSettings: React.FC = () => {
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [savedWhatsappUrl, setSavedWhatsappUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const config = await getPublicSiteConfig();
      const current = config.whatsappUrl || TEMPORARY_FALLBACK_WHATSAPP_URL;
      setWhatsappUrl(current);
      setSavedWhatsappUrl(current);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Não foi possível carregar as configurações do Firestore. ' + (err?.message || ''),
      });
      setWhatsappUrl(TEMPORARY_FALLBACK_WHATSAPP_URL);
      setSavedWhatsappUrl(TEMPORARY_FALLBACK_WHATSAPP_URL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmed = whatsappUrl.trim();

    if (!trimmed) {
      setFeedback({
        type: 'error',
        message: 'O link do WhatsApp não pode ficar vazio.',
      });
      return;
    }

    if (!isValidWhatsAppUrl(trimmed)) {
      setFeedback({
        type: 'error',
        message: 'Por favor insira um link de WhatsApp válido (ex: https://wa.me/5531999044206 ou https://api.whatsapp.com/send?phone=5531999044206).',
      });
      return;
    }

    setSaving(true);
    try {
      await updatePublicSiteConfig({
        whatsappUrl: trimmed,
      });

      setSavedWhatsappUrl(trimmed);
      const syncNote = await syncServiceLinks();
      setFeedback({
        type: syncNote.startsWith(' Atenção') ? 'error' : 'success',
        message: 'Link do WhatsApp salvo com sucesso no Firestore! Todos os botões do site já estão atualizados.' + syncNote,
      });
    } catch (err) {
      logger.error('[AdminSettings] Erro ao salvar:', err);
      setFeedback({
        type: 'error',
        message: 'Falha ao salvar configuração no Firestore: ' + (err?.message || 'Verifique suas permissões de administrador.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setWhatsappUrl(TEMPORARY_FALLBACK_WHATSAPP_URL);
  };

  const hasChanges = whatsappUrl.trim() !== savedWhatsappUrl.trim();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {/* Top Header */}
      <SettingsHeader />

      {/* Feedback Alert */}
      {feedback && <SettingsFeedback feedback={feedback} />}

      {/* WhatsApp Section */}
      <WhatsAppCard
        loading={loading}
        whatsappUrl={whatsappUrl}
        setWhatsappUrl={setWhatsappUrl}
        savedWhatsappUrl={savedWhatsappUrl}
        saving={saving}
        hasChanges={hasChanges}
        onSubmit={handleSave}
        onReset={handleResetToDefault}
      />

      {/* Security & Architecture Info Note */}
      <SecurityNote />

    </div>
  );
};
