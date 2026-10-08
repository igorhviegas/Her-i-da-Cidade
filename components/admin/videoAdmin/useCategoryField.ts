import { useState, useEffect } from 'react';
import { Video } from '../../../types';
import { createCategory } from '../../../services/categoriesService';

export const useCategoryField = (video: Video | null | undefined, existingCategories: string[]) => {
  const initialCategories = Array.isArray(video?.categories)
    ? video.categories
    : (video?.category ? [video.category] : []);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Sempre que o modal abrir ou o vídeo mudar, atualizar estados
  useEffect(() => {
    if (video) {
      const cats = Array.isArray(video.categories)
        ? video.categories
        : (video.category ? [video.category] : []);
      setCategories(cats);
    } else {
      setCategories([]);
    }
    setCategoryError(null);
  }, [video]);

  const allCategories = Array.from(
    new Set([...existingCategories, ...categories].map(c => c.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Alterna uma categoria (marca/desmarca) sem duplicar
  const toggleCategory = (cat: string) => {
    setCategoryError(null);
    const target = cat.trim();
    setCategories(prev =>
      prev.some(c => c.trim().toLowerCase() === target.toLowerCase())
        ? prev.filter(c => c.trim().toLowerCase() !== target.toLowerCase())
        : [...prev, target]
    );
  };

  // Remove explicitamente uma categoria selecionada
  const removeCategory = (catToRemove: string) => {
    setCategoryError(null);
    const target = catToRemove.trim().toLowerCase();
    setCategories(prev => prev.filter(c => c.trim().toLowerCase() !== target));
  };

  // Adiciona nova categoria sem duplicar
  const handleAddNewCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some(c => c.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewCategory('');
      return;
    }
    try {
      const category = await createCategory(trimmed);
      setCategories(prev => [...prev, category.name]);
      setNewCategory('');
      setCategoryError(null);
    } catch (err) {
      setCategoryError(err?.message || 'Não foi possível criar a categoria.');
    }
  };

  return {
    categories, allCategories, newCategory, setNewCategory, categoryError,
    toggleCategory, removeCategory, handleAddNewCategory,
  };
};
