import React, { useState, useEffect } from 'react';
import { 
  getPublicSiteConfig, 
  updatePublicSiteConfig, 
  isValidWhatsAppUrl, 
  TEMPORARY_FALLBACK_WHATSAPP_URL 
} from '../../services/siteConfigService';
import { 
  Settings, 
  MessageCircle, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  RotateCcw,
  Save,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';

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
    } catch (err: any) {
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
      setFeedback({
        type: 'success',
        message: 'Link do WhatsApp salvo com sucesso no Firestore! Todos os botões do site já estão atualizados.',
      });
    } catch (err: any) {
      console.error('[AdminSettings] Erro ao salvar:', err);
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
      <div className="border-b border-white/10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Módulo Ativo
              </span>
              <span className="text-xs text-white/40">siteConfig/public</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-400" />
              Configurações Gerais
            </h1>
            <p className="text-sm text-white/60 mt-1 font-light">
              Gerenciamento dos parâmetros globais do site e canais diretos de conversão.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all animate-in slide-in-from-top-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
        </div>
      )}

      {/* WhatsApp Section */}
      <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/10">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              WhatsApp de Conversão
            </h2>
            <p className="text-sm text-white/60 font-light mt-0.5">
              Esta é a fonte de verdade para todos os botões e links de WhatsApp do site público (botão flutuante, cards de serviços, seção sobre e rodapé).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <span className="text-sm">Carregando configurações do Firestore...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Input Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="whatsappUrl" className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Link do WhatsApp
                </label>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Ex: https://wa.me/5531999044206</span>
                </div>
              </div>

              <div className="relative">
                <input
                  id="whatsappUrl"
                  type="text"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsappUrl(e.target.value)}
                  placeholder="https://wa.me/5531999044206"
                  disabled={saving}
                  className="w-full bg-[#070B14] border border-white/10 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 transition-all outline-none font-mono"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                <div>
                  <span className="text-white/30">Valor atualmente ativo: </span>
                  <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {savedWhatsappUrl || 'Nenhum valor salvo'}
                  </span>
                </div>

                {savedWhatsappUrl && (
                  <a
                    href={savedWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span>Testar link atual</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs font-medium transition-all"
                title="Restaura a URL padrão oficial do projeto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrão Oficial</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !hasChanges}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                    hasChanges && !saving
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Configuração</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        )}
      </div>

      {/* Security & Architecture Info Note */}
      <div className="bg-[#0B1120] border border-white/5 rounded-2xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="text-xs text-white/60 space-y-1 leading-relaxed">
          <p className="font-bold text-white text-sm">Arquitetura de Contingência e Segurança</p>
          <p>
            O link do WhatsApp é armazenado no Firestore no documento <code className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">siteConfig/public</code>.
          </p>
          <p>
            As Security Rules protegem este documento contra alterações não autorizadas, permitindo leitura pública para os visitantes e escrita restrita aos administradores autenticados.
          </p>
        </div>
      </div>

    </div>
  );
};
