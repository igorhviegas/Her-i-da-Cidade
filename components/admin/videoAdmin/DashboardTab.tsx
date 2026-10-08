import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  Shield,
  Sparkles,
  Video,
  FileText,
  Settings,
  CheckCircle2,
  Database,
  Layers,
  Clock,
  ArrowRight,
  UserCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { AdminTab } from './dashboardTypes';

type AdminUser = ReturnType<typeof useAuth>['user'];

// Welcome Hero Card
const DashboardHero: React.FC<{ user: AdminUser }> = ({ user }) => (
  <div className="bg-gradient-to-r from-blue-950/50 via-[#0E1626] to-[#0A101D] border border-blue-500/20 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
    <div className="max-w-2xl relative z-10">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
        <UserCheck className="w-3.5 h-3.5" />
        Sessão Administrativa Ativa
      </span>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
        Bem-vindo, {user?.displayName || user?.email?.split('@')[0] || 'Administrador'}!
      </h2>
      <p className="text-sm sm:text-base text-white/70 leading-relaxed font-light">
        A fundação da área administrativa do <strong className="text-white font-medium">Herói da Cidade</strong> está configurada e integrada com autenticação protegida e Firestore Security Rules.
      </p>
    </div>
  </div>
);

interface DashboardStatusGridProps {
  servicesCount: number | null;
  isSyncing: boolean;
  onSync: () => void;
}

// Status Grid
const DashboardStatusGrid: React.FC<DashboardStatusGridProps> = ({ servicesCount, isSyncing, onSync }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

    <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Projeto Firebase
        </span>
        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
          <Database className="w-4 h-4" />
        </div>
      </div>
      <p className="text-lg font-bold text-white tracking-tight">heroi-da-cidade</p>
      <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Conectado ao Cloud Firestore (default)
      </p>
    </div>

    <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Autenticação & Regras
        </span>
        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
          <Shield className="w-4 h-4" />
        </div>
      </div>
      <p className="text-lg font-bold text-white tracking-tight">Permissões de Admin</p>
      <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
        <span className="text-emerald-400 font-semibold">Regras ativas:</span> Coleção admins/{'{uid}'}
      </p>
    </div>

    <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Coleção de Serviços
          </span>
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <p className="text-lg font-bold text-white tracking-tight">
          {servicesCount !== null ? `${servicesCount} Serviços no Firestore` : 'Consultando Firestore...'}
        </p>
        <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          IDs 1 a 6 mapeados com active: true
        </p>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Verificar / Sincronizar'}</span>
        </button>
        <span className="text-[10px] text-white/40">Idempotente</span>
      </div>
    </div>

  </div>
);

interface SyncFeedbackProps {
  syncFeedback: { type: 'success' | 'error'; message: string };
}

// Feedback de Sincronização
const SyncFeedbackBanner: React.FC<SyncFeedbackProps> = ({ syncFeedback }) => (
  <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
    syncFeedback.type === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : 'bg-red-500/10 border-red-500/30 text-red-300'
  }`}>
    {syncFeedback.type === 'success' ? (
      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
    ) : (
      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
    )}
    <span className="flex-1 font-medium">{syncFeedback.message}</span>
  </div>
);

interface DashboardModuleCardsProps {
  onNavigate: (tab: AdminTab) => void;
  onOpenVideos: () => void;
}

// Module Cards (Roadmap / Futuros Módulos)
const DashboardModuleCards: React.FC<DashboardModuleCardsProps> = ({ onNavigate, onOpenVideos }) => (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
        Módulos Administrativos
      </h3>
      <span className="text-xs text-white/40">
        Estrutura preparada para expansão modular
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

      {/* Card Serviços */}
      <div
        onClick={() => onNavigate('services')}
        className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-blue-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Ativo • Gerenciável
          </span>
        </div>
        <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
          Serviços e Preços
        </h4>
        <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
          Gerenciamento completo: criar novos serviços, editar preços, alterar status ativo/inativo, reordenar e excluir.
        </p>
        <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
          <span>Acessar gerenciador de serviços</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Card Vídeos */}
      <div
        onClick={onOpenVideos}
        className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
            <Video className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Em breve • Etapa 4
          </span>
        </div>
        <h4 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors mb-2">
          Plataforma de vídeos
        </h4>
        <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
          Catálogo e indexação de conteúdos educativos e divertidos do Instagram, categorizados por temas e faixa etária.
        </p>
        <div className="flex items-center gap-1 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
          <span>Ver detalhes do módulo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Card Conteúdo */}
      <div
        onClick={() => onNavigate('content')}
        className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Ativo
          </span>
        </div>
        <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mb-2">
          Textos & Conteúdo
        </h4>
        <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
          Edição de textos estratégicos do site, frases de impacto, seção Sobre e links de agendamento.
        </p>
        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
          <span>Ver detalhes do módulo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Card Configurações */}
      <div
        onClick={() => onNavigate('settings')}
        className="group bg-[#0D1527] hover:bg-[#111B30] border border-white/10 hover:border-slate-400 rounded-2xl p-6 transition-all cursor-pointer shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform">
            <Settings className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Ativo • Gerenciável
          </span>
        </div>
        <h4 className="text-lg font-bold text-white group-hover:text-slate-300 transition-colors mb-2">
          Configurações Gerais
        </h4>
        <p className="text-sm text-white/60 leading-relaxed font-light mb-4">
          Gerenciamento de canais de conversão (WhatsApp), parâmetros do sistema e dados públicos do site.
        </p>
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:translate-x-1 transition-transform">
          <span>Acessar configurações</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>

    </div>
  </div>
);

interface DashboardTabProps {
  user: AdminUser;
  servicesCount: number | null;
  isSyncing: boolean;
  syncFeedback: { type: 'success' | 'error'; message: string } | null;
  onSync: () => void;
  onNavigate: (tab: AdminTab) => void;
  onOpenVideos: () => void;
}

// TAB: DASHBOARD
export const DashboardTab: React.FC<DashboardTabProps> = ({
  user,
  servicesCount,
  isSyncing,
  syncFeedback,
  onSync,
  onNavigate,
  onOpenVideos,
}) => (
  <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">

    <DashboardHero user={user} />

    <DashboardStatusGrid servicesCount={servicesCount} isSyncing={isSyncing} onSync={onSync} />

    {syncFeedback && <SyncFeedbackBanner syncFeedback={syncFeedback} />}

    <DashboardModuleCards onNavigate={onNavigate} onOpenVideos={onOpenVideos} />

  </div>
);
