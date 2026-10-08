import React from 'react';

interface VideoCategoriesFieldProps {
  categories: string[];
  allCategories: string[];
  newCategory: string;
  onNewCategoryChange: (value: string) => void;
  categoryError: string | null;
  toggleCategory: (cat: string) => void;
  removeCategory: (cat: string) => void;
  handleAddNewCategory: () => void;
}

// Campo Múltiplas Categorias
export const VideoCategoriesField: React.FC<VideoCategoriesFieldProps> = ({
  categories,
  allCategories,
  newCategory,
  onNewCategoryChange,
  categoryError,
  toggleCategory,
  removeCategory,
  handleAddNewCategory,
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="block text-sm font-medium text-white/80">Categorias</label>
      {categories.length > 0 && (
        <span className="text-[11px] text-white/40">{categories.length} selecionada(s)</span>
      )}
    </div>

    {/* Badges de Categorias Selecionadas com remoção instantânea */}
    {categories.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {categories.map(cat => (
          <span
            key={cat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-medium"
          >
            <span>{cat}</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeCategory(cat);
              }}
              className="text-emerald-300/70 hover:text-white transition flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-emerald-500/30"
              aria-label={`Remover categoria ${cat}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    )}

    {/* Lista de Checkboxes de Categorias Existentes */}
    <div className="max-h-36 overflow-y-auto border border-white/10 bg-[#090E1B] rounded-lg p-2 space-y-1">
      {allCategories.length === 0 ? (
        <p className="text-xs text-white/40 px-1 py-1">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        allCategories.map(cat => {
          const isChecked = categories.some(c => c.trim().toLowerCase() === cat.trim().toLowerCase());
          return (
            <label
              key={cat}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition ${
                isChecked ? 'bg-emerald-500/10 text-emerald-300 font-medium' : 'text-white/80 hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleCategory(cat)}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              <span>{cat}</span>
            </label>
          );
        })
      )}
    </div>

    {/* Adicionar nova categoria */}
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={newCategory}
        onChange={e => onNewCategoryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewCategory();
          }
        }}
        placeholder="Nova categoria (ex: Hábitos)"
        className="flex-1 bg-[#090E1B] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
      />
      <button
        type="button"
        onClick={handleAddNewCategory}
        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition"
      >
        Adicionar
      </button>
    </div>

    {categoryError && <p className="text-xs text-red-400 mt-1">{categoryError}</p>}
  </div>
);
