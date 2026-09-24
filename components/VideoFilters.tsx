import React, { useState } from 'react';

interface VideoFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  videos: any[]; // we only need categories list
}

export const VideoFilters: React.FC<VideoFiltersProps> = ({ search, onSearchChange, category, onCategoryChange, videos }) => {
  // Derive unique categories from videos
  const uniqueCategories = Array.from(new Set(videos.flatMap(v => v.categories || [])));

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
      <input
        type="text"
        placeholder="Buscar..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="px-3 py-2 rounded bg-[#0D1527] text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]"
      />
      <select
        value={category}
        onChange={e => onCategoryChange(e.target.value)}
        className="px-3 py-2 rounded bg-[#0D1527] text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]"
      >
        <option value="">Todas as categorias</option>
        {uniqueCategories.map(cat => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
};
