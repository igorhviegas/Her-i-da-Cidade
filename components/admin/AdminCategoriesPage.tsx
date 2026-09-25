import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Category, countCategoryVideos, createCategory, deleteCategory, getCategories, syncCategoriesFromVideos, updateCategory } from '../../services/categoriesService';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<{ category: Category; videoCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      await syncCategoriesFromVideos();
      setCategories(await getCategories());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadCategories(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await updateCategory(editing, name);
      else await createCategory(name);
      setName('');
      setEditing(null);
      await loadCategories();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const beginDelete = async (category: Category) => {
    try {
      setDeleting({ category, videoCount: await countCategoryVideos(category) });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível verificar os vídeos associados.');
    }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteCategory(deleting.category);
      setDeleting(null);
      await loadCategories();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir a categoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-white">CATEGORIAS</h2>
        <p className="text-xs text-white/50 mt-0.5">Gerencie as categorias disponíveis para os vídeos.</p>
      </div>
      {error && <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>}
      <form onSubmit={save} className="bg-[#0D1527] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nome da categoria" className="flex-1 bg-[#070B14] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition">
          {editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editing ? 'Salvar alteração' : 'Nova categoria'}
        </button>
        {editing && <button type="button" onClick={() => { setEditing(null); setName(''); }} className="px-3 py-2 text-white/60 hover:text-white"><X className="w-4 h-4" /></button>}
      </form>
      <div className="bg-[#0D1527] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? <p className="p-6 text-center text-sm text-white/60">Carregando categorias...</p> : categories.length === 0 ? <p className="p-6 text-center text-sm text-white/60">Nenhuma categoria cadastrada ainda.</p> : categories.map((category, index) => (
          <div key={category.id} className={`flex items-center justify-between gap-4 px-4 py-3 ${index ? 'border-t border-white/10' : ''}`}>
            <span className="text-sm text-white font-medium">{category.name}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setEditing(category); setName(category.name); setError(null); }} className="p-2 rounded-lg text-white/55 hover:text-blue-300 hover:bg-blue-500/10" aria-label={`Editar ${category.name}`}><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={() => beginDelete(category)} className="p-2 rounded-lg text-white/55 hover:text-red-300 hover:bg-red-500/10" aria-label={`Excluir ${category.name}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-md bg-[#0D1527] border border-white/10 rounded-2xl p-6 shadow-2xl"><h3 className="text-lg font-bold text-white">Excluir categoria?</h3><p className="mt-3 text-sm text-white/70">{deleting.videoCount > 0 ? `Esta categoria está sendo usada por ${deleting.videoCount} vídeo${deleting.videoCount === 1 ? '' : 's'}. Ela será removida desses vídeos, que continuarão cadastrados.` : 'Esta categoria não está sendo usada por vídeos.'}</p><div className="flex justify-end gap-3 mt-6"><button type="button" disabled={saving} onClick={() => setDeleting(null)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm">Cancelar</button><button type="button" disabled={saving} onClick={confirmDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">{saving ? 'Excluindo...' : 'Excluir categoria'}</button></div></div></div>}
    </div>
  );
};
