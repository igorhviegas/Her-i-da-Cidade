import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff, 
  ArrowUpDown, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Layers,
  Info
} from 'lucide-react';
import { 
  useServices, 
  createService, 
  updateService, 
  deleteService, 
  toggleServiceStatus, 
  updateServiceOrder,
  CreateServiceInput,
  UpdateServiceInput
} from '../../services/servicesService';
import { Service } from '../../types';

interface ServiceFormData {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  order: number;
  active: boolean;
}

const DEFAULT_CATEGORIES = [
  'Pronta entrega',
  'Ao Vivo',
  'Exclusivo',
  'Presencial'
];

export const AdminServices: React.FC = () => {
  // Busca todos os serviços (ativos e inativos) com sincronização em tempo real
  const { services, loading, error, refetch } = useServices({
    onlyActive: false,
    realTime: true,
  });

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal de Criação / Edição
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    title: '',
    price: '',
    description: '',
    imageUrl: '',
    category: 'Pronta entrega',
    order: 1,
    active: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ServiceFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Confirmação de Exclusão
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de feedback / notificação
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  // Filtragem e busca no frontend
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch = 
        service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.price.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus === 'active') return service.active !== false;
      if (filterStatus === 'inactive') return service.active === false;
      return true;
    });
  }, [services, searchTerm, filterStatus]);

  // Contagens para os badges
  const activeCount = useMemo(() => services.filter((s) => s.active !== false).length, [services]);
  const inactiveCount = useMemo(() => services.filter((s) => s.active === false).length, [services]);

  // Abertura do formulário para criação
  const handleOpenCreateModal = () => {
    const nextOrder = services.reduce((max, s) => Math.max(max, s.order ?? 0), 0) + 1;
    setEditingServiceId(null);
    setIsCustomCategory(false);
    setFormData({
      title: '',
      price: '',
      description: '',
      imageUrl: '',
      category: 'Pronta entrega',
      order: nextOrder,
      active: true,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Abertura do formulário para edição
  const handleOpenEditModal = (service: Service) => {
    setEditingServiceId(service.id);
    const isStandardCategory = DEFAULT_CATEGORIES.includes(service.category);
    setIsCustomCategory(!isStandardCategory);
    setFormData({
      title: service.title,
      price: service.price,
      description: service.description,
      imageUrl: service.imageUrl,
      category: service.category,
      order: service.order ?? 1,
      active: service.active !== false,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Validação do formulário
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ServiceFormData, string>> = {};

    if (!formData.title.trim()) {
      errors.title = 'O nome do serviço é obrigatório.';
    }
    if (!formData.price.trim()) {
      errors.price = 'O preço do serviço é obrigatório (ex: Apenas R$ 35, Sob Consulta).';
    }
    if (!formData.description.trim()) {
      errors.description = 'A descrição do serviço é obrigatória.';
    }
    if (!formData.category.trim()) {
      errors.category = 'A categoria é obrigatória.';
    }
    if (!formData.imageUrl.trim()) {
      errors.imageUrl = 'A URL da imagem é obrigatória.';
    } else if (!formData.imageUrl.startsWith('http://') && !formData.imageUrl.startsWith('https://')) {
      errors.imageUrl = 'Informe uma URL válida iniciada por https:// ou http://';
    }
    if (typeof formData.order !== 'number' || isNaN(formData.order) || formData.order < 1) {
      errors.order = 'A ordem de exibição deve ser um número maior que zero.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Salvar serviço (Criação ou Edição)
  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingServiceId) {
        // Atualização
        const updates: UpdateServiceInput = {
          title: formData.title,
          price: formData.price,
          description: formData.description,
          imageUrl: formData.imageUrl,
          category: formData.category,
          order: formData.order,
          active: formData.active,
        };
        await updateService(editingServiceId, updates);
        showFeedback('success', `Serviço "${formData.title}" atualizado com sucesso! Alterações já visíveis no site.`);
      } else {
        // Criação
        const newServicePayload: CreateServiceInput = {
          title: formData.title,
          price: formData.price,
          description: formData.description,
          imageUrl: formData.imageUrl,
          category: formData.category,
          order: formData.order,
          active: formData.active,
        };
        await createService(newServicePayload);
        showFeedback('success', `Novo serviço "${formData.title}" cadastrado com sucesso!`);
      }

      setIsFormModalOpen(false);
      setEditingServiceId(null);
    } catch (err: any) {
      console.error('[AdminServices] Erro ao salvar serviço:', err);
      let errorMsg = 'Falha ao salvar o serviço. Verifique suas permissões de administrador.';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error) {
            errorMsg = `Falha de permissão (${parsed.operationType}): ${parsed.error}`;
          }
        } catch {
          errorMsg = err.message;
        }
      }
      showFeedback('error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar status ativo/inativo
  const handleToggleStatus = async (service: Service) => {
    const newStatus = !service.active;
    try {
      await toggleServiceStatus(service.id, service.active !== false);
      showFeedback(
        'success', 
        `Serviço "${service.title}" ${newStatus ? 'ativado e publicado no site' : 'desativado (ocultado do site público)'}.`
      );
    } catch (err: any) {
      console.error('[AdminServices] Erro ao alterar status:', err);
      showFeedback('error', 'Não foi possível alterar o status do serviço.');
    }
  };

  // Ajustar ordem rápida (+1 ou -1)
  const handleQuickOrderChange = async (service: Service, delta: number) => {
    const currentOrder = service.order ?? 1;
    const newOrder = Math.max(1, currentOrder + delta);
    if (newOrder === currentOrder) return;

    try {
      await updateServiceOrder(service.id, newOrder);
      showFeedback('success', `Ordem do serviço "${service.title}" ajustada para ${newOrder}.`);
    } catch (err: any) {
      console.error('[AdminServices] Erro ao alterar ordem:', err);
      showFeedback('error', 'Falha ao reordenar o serviço.');
    }
  };

  // Excluir serviço após confirmação
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteService(serviceToDelete.id);
      showFeedback('success', `Serviço "${serviceToDelete.title}" excluído com sucesso.`);
      setServiceToDelete(null);
    } catch (err: any) {
      console.error('[AdminServices] Erro ao excluir serviço:', err);
      showFeedback('error', 'Falha ao excluir o serviço. Verifique suas permissões.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. CABEÇALHO DA SEÇÃO COM AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0D1527] border border-white/10 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Gerenciamento de Serviços
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-white/60 font-light max-w-xl">
            Edite nomes, preços, descrições, imagens e reordene os serviços exibidos no site público em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo serviço</span>
          </button>
        </div>
      </div>

      {/* 2. NOTIFICAÇÃO / FEEDBACK BANNER */}
      {feedback && (
        <div 
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/15 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)}
            className="p-1 text-white/50 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0D1527] border border-white/10 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar serviços por nome, categoria ou preço..."
            className="w-full pl-10 pr-10 py-2 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-1.5 p-1 bg-[#070B14] border border-white/10 rounded-xl shrink-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Todos ({services.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Ativos ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === 'inactive'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Inativos ({inactiveCount})
          </button>
        </div>
      </div>

      {/* 4. ESTADO DE ERRO */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white mb-1">Não foi possível carregar os serviços</h3>
          <p className="text-xs text-white/60 mb-4 font-light max-w-md mx-auto">{error}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* 5. ESTADO DE CARREGAMENTO */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-[#0D1527] border border-white/10 rounded-2xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 bg-white/10 rounded" />
                <div className="w-1/4 h-3 bg-white/5 rounded" />
              </div>
              <div className="w-20 h-6 bg-white/10 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* 6. ESTADO VAZIO */}
      {!loading && !error && filteredServices.length === 0 && (
        <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 mx-auto mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {searchTerm || filterStatus !== 'all' ? 'Nenhum serviço corresponde ao filtro' : 'Você ainda não possui serviços cadastrados'}
          </h3>
          <p className="text-xs text-white/60 font-light max-w-sm mx-auto mb-6">
            {searchTerm || filterStatus !== 'all'
              ? 'Tente ajustar os termos da pesquisa ou alterar os filtros de status.'
              : 'Clique no botão abaixo para adicionar seu primeiro serviço ao catálogo.'}
          </p>
          {searchTerm || filterStatus !== 'all' ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
            >
              <span>Limpar filtros de busca</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Criar primeiro serviço</span>
            </button>
          )}
        </div>
      )}

      {/* 7. TABELA DESKTOP (lg+) */}
      {!loading && !error && filteredServices.length > 0 && (
        <>
          <div className="hidden lg:block bg-[#0D1527] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">Ordem</th>
                  <th className="py-3.5 px-4 w-20">Imagem</th>
                  <th className="py-3.5 px-4">Nome & Descrição</th>
                  <th className="py-3.5 px-4 w-36">Categoria</th>
                  <th className="py-3.5 px-4 w-36">Preço</th>
                  <th className="py-3.5 px-4 w-32 text-center">Status</th>
                  <th className="py-3.5 px-4 w-32 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredServices.map((service) => {
                  const isActive = service.active !== false;
                  return (
                    <tr 
                      key={service.id} 
                      className={`hover:bg-white/[0.02] transition-colors ${!isActive ? 'opacity-70 bg-black/20' : ''}`}
                    >
                      {/* Ordem com botões rápidos */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            onClick={() => handleQuickOrderChange(service, -1)}
                            title="Mover para cima"
                            className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-sm text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-md">
                            {service.order ?? 0}
                          </span>
                          <button
                            onClick={() => handleQuickOrderChange(service, 1)}
                            title="Mover para baixo"
                            className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Imagem */}
                      <td className="py-4 px-4">
                        <div className="w-14 h-20 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 relative group">
                          {service.imageUrl ? (
                            <img
                              src={service.imageUrl}
                              alt={service.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Nome e Descrição */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base tracking-tight">
                              {service.title}
                            </span>
                            {!isActive && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/10 text-white/50 rounded-full">
                                Oculto no site
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/60 font-light line-clamp-2 leading-relaxed max-w-xl">
                            {service.description}
                          </p>
                          <div className="text-[10px] text-white/30 font-mono">
                            ID: {service.id}
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-white/80 border border-white/10">
                          <Tag className="w-3 h-3 text-blue-400" />
                          {service.category}
                        </span>
                      </td>

                      {/* Preço (String livre) */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          {service.price}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(service)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                            isActive
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-white/5 border-white/15 text-white/40 hover:bg-white/10'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                          <span>{isActive ? 'Ativo' : 'Inativo'}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(service)}
                            title="Editar serviço"
                            className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-blue-600 rounded-xl transition-colors border border-white/5"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setServiceToDelete(service)}
                            title="Excluir serviço"
                            className="p-2 text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-600 rounded-xl transition-colors border border-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 8. CARDS RESPONSIVOS MOBILE E TABLET (<lg) */}
          <div className="lg:hidden space-y-4">
            {filteredServices.map((service) => {
              const isActive = service.active !== false;
              return (
                <div
                  key={service.id}
                  className={`bg-[#0D1527] border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg transition-all ${
                    !isActive ? 'opacity-75 bg-[#090E1B]' : ''
                  }`}
                >
                  {/* Topo do card com miniatura e dados principais */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-16 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                      {service.imageUrl ? (
                        <img
                          src={service.imageUrl}
                          alt={service.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-bold text-white tracking-tight leading-snug">
                          {service.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/10">
                          {service.category}
                        </span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {service.price}
                        </span>
                      </div>

                      <p className="text-xs text-white/60 font-light line-clamp-2 pt-1">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  {/* Barra de controle inferior: Ordem, Status e Botões de Ação */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    {/* Controle de Ordem */}
                    <div className="flex items-center gap-1.5 bg-[#070B14] border border-white/10 px-2 py-1 rounded-xl">
                      <span className="text-[11px] text-white/40 font-medium">Ordem:</span>
                      <button
                        onClick={() => handleQuickOrderChange(service, -1)}
                        className="p-0.5 text-white/60 hover:text-white"
                        title="Diminuir ordem"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-blue-400 px-1">
                        {service.order ?? 0}
                      </span>
                      <button
                        onClick={() => handleQuickOrderChange(service, 1)}
                        className="p-0.5 text-white/60 hover:text-white"
                        title="Aumentar ordem"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Botão de Toggle Status */}
                    <button
                      onClick={() => handleToggleStatus(service)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        isActive
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/5 border-white/15 text-white/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-white/40'}`} />
                      <span>{isActive ? 'Ativo' : 'Inativo'}</span>
                    </button>

                    {/* Ações Editar e Excluir */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(service)}
                        className="p-2 text-white/80 bg-white/5 hover:bg-blue-600 rounded-xl border border-white/5 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setServiceToDelete(service)}
                        className="p-2 text-red-400 bg-red-500/10 hover:bg-red-600 rounded-xl border border-red-500/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 9. MODAL DE FORMULÁRIO: NOVO / EDITAR SERVIÇO */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => !isSubmitting && setIsFormModalOpen(false)}
          />

          {/* Dialog Container */}
          <div className="relative w-full max-w-2xl bg-[#0D1527] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-10 my-8 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
                  </h3>
                  <p className="text-xs text-white/50 font-light">
                    {editingServiceId ? 'Atualize as informações do serviço existente' : 'Preencha os dados para adicionar ao Firestore'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                disabled={isSubmitting}
                className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitService} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Nome / Título */}
              <div>
                <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                  Nome do Serviço <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="ex: Vídeo Especial de Aniversário"
                  className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
                    formErrors.title ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
                  }`}
                />
                {formErrors.title && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Grid 2 colunas: Preço e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Preço (String Livre) */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                    Preço (Formato Textual) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="ex: Apenas R$ 35 ou Sob Consulta"
                    className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
                      formErrors.price ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
                    }`}
                  />
                  <p className="text-[11px] text-white/40 mt-1">
                    Mantenha o texto livre (ex: "Apenas R$ 30", "15 minutos R$ 75").
                  </p>
                  {formErrors.price && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.price}</p>
                  )}
                </div>

                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                      Categoria <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {isCustomCategory ? 'Escolher pré-definida' : '+ Nova categoria'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Nome da nova categoria..."
                      className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
                        formErrors.category ? 'border-red-500' : 'border-white/10 focus:border-blue-500'
                      }`}
                    />
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                  {formErrors.category && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.category}</p>
                  )}
                </div>

              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                  Descrição do Serviço <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o que o cliente recebe neste serviço..."
                  className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
                    formErrors.description ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
                  }`}
                />
                {formErrors.description && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.description}</p>
                )}
              </div>

              {/* URL da Imagem & Preview */}
              <div>
                <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                  URL da Imagem <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://exemplo.com/imagem.jpeg"
                      className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
                        formErrors.imageUrl ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
                      }`}
                    />
                    <p className="text-[11px] text-white/40 mt-1">
                      Link direto para imagem (JPG, PNG ou WEBP em proporção vertical recomendada 2:3).
                    </p>
                  </div>

                  {/* Preview Container */}
                  <div className="w-16 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                    {formData.imageUrl ? (
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-white/20" />
                    )}
                  </div>
                </div>
                {formErrors.imageUrl && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.imageUrl}</p>
                )}
              </div>

              {/* Grid 2 colunas: Ordem e Status Inicial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                
                {/* Ordem */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                    Ordem de Exibição <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-white/40 mt-1">
                    1 = primeiro card do carrossel no site.
                  </p>
                  {formErrors.order && (
                    <p className="text-xs text-red-400 mt-1">{formErrors.order}</p>
                  )}
                </div>

                {/* Status Ativo/Inativo */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
                    Status de Publicação
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: !formData.active })}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      formData.active
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/15 text-white/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${formData.active ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
                      <span>{formData.active ? 'Ativo (Publicado no site)' : 'Inativo (Oculto do site)'}</span>
                    </div>
                    {formData.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <p className="text-[11px] text-white/40 mt-1">
                    Serviços inativos não são mostrados ao público.
                  </p>
                </div>

              </div>

              {/* Botões do Modal */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingServiceId ? 'Salvar Alterações' : 'Criar Serviço'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => !isDeleting && setServiceToDelete(null)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md bg-[#0D1527] border border-red-500/30 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Excluir Serviço Permanentemente?
            </h3>
            <p className="text-xs text-white/70 font-light leading-relaxed mb-4">
              Tem certeza que deseja excluir o serviço <strong className="text-white font-semibold">"{serviceToDelete.title}"</strong>? 
              O documento correspondente será removido da base do Firestore e deixará de existir no site público.
            </p>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 mb-6 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Dica:</strong> Em vez de excluir, você pode apenas <strong>Desativar</strong> o serviço para ocultá-lo do público sem perder suas informações.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setServiceToDelete(null)}
                className="px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Sim, Excluir Serviço</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
