import React, { useState } from 'react';
import { useRouter } from '../lib/router';

export const VideoSection: React.FC = () => {
  const { navigate } = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const quickThemes = [
    'Higiene',
    'Alimentação',
    'Escovar os dentes',
    'Medo',
    'Escola',
    'Amizade',
    'Hábitos',
    'Saúde',
  ];

  const handleSearch = (termToSearch: string) => {
    const trimmed = termToSearch.trim();
    if (trimmed) {
      navigate(`/videos?search=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/videos');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  return (
    <section className="relative py-16 sm:py-24 bg-[#070b14] overflow-hidden" id="videos">
      {/* Luzes de fundo atmosféricas */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/4 right-10 w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge da plataforma */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Plataforma de Vídeos
        </div>

        {/* Título principal */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
          Encontre o vídeo certo para cada momento.
        </h2>

        {/* Texto explicativo conciso */}
        <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-white/70 leading-relaxed">
          O Herói da Cidade disponibiliza uma plataforma exclusiva onde pais e educadores encontram vídeos por temas específicos para orientar, divertir e inspirar as crianças.
        </p>

        {/* Campo de pesquisa */}
        <form onSubmit={onSubmit} className="mt-8 max-w-xl mx-auto">
          <div className="relative flex items-center bg-white/[0.08] hover:bg-white/[0.11] border border-white/15 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/30 transition-all">
            <svg
              className="w-5 h-5 text-white/40 ml-3.5 flex-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquise um tema... Ex: escovar os dentes, higiene"
              className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-white placeholder:text-white/40 outline-none"
            />
            <button
              type="submit"
              className="flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              Pesquisar
            </button>
          </div>
        </form>

        {/* Sugestões de temas rápidos */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
          <span className="text-xs text-white/50 font-medium mr-1">Exemplos de busca:</span>
          {quickThemes.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => handleSearch(theme)}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 hover:border-white/25 transition-all cursor-pointer"
            >
              {theme}
            </button>
          ))}
        </div>

        {/* Botão de acesso ao catálogo completo */}
        <div className="mt-9">
          <button
            type="button"
            onClick={() => navigate('/videos')}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-blue-500/10 cursor-pointer active:scale-95"
          >
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Acessar catálogo completo</span>
          </button>
        </div>
      </div>
    </section>
  );
};
