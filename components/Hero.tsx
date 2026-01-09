
import React from 'react';

export const Hero: React.FC = () => {
  return (
    <section className="relative h-screen flex flex-col justify-end sm:justify-center items-start overflow-hidden bg-[#0B1929]">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        {/* Hero Image - Optimized for all screens */}
        <img 
          src="https://rising-brown-rufjc3ycjc.edgeone.app/WhatsApp%20Image%202026-01-08%20at%2015.00.34.jpeg" 
          alt="O Herói da Cidade" 
          className="w-full h-full object-cover object-center sm:object-[75%_center] opacity-90 brightness-[0.55] contrast-110 saturate-[1.1] transition-transform duration-[20s] ease-out scale-105"
        />

        {/* Cinematic Overlays (Disney+ Style) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1929] via-[#0B1929]/60 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1929] via-[#0B1929]/50 to-transparent z-10 hidden sm:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1929]/70 via-transparent to-transparent z-10" />
        <div className="absolute inset-0 radial-vignette z-10" />
      </div>

      {/* Content Area */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-12 md:px-20 pb-16 sm:pb-0 flex flex-col items-start text-left">
        <div className="inline-block px-4 py-1.5 bg-blue-500/10 backdrop-blur-xl rounded-full border border-blue-400/30 mb-6 shadow-[0_0_20px_rgba(59,130,246,0.1)] animate-fade-in-up">
          <span className="text-[9px] sm:text-xs font-black tracking-[0.4em] uppercase text-blue-400 drop-shadow-sm">Serviços Exclusivos</span>
        </div>
        
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-4 sm:mb-6 tracking-tighter leading-[0.85] italic uppercase text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
          O Herói <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-500 to-indigo-600">Da Cidade</span>
        </h1>

        <p className="text-sm sm:text-lg md:text-xl text-white/90 mb-8 sm:mb-10 max-w-md font-extralight italic leading-relaxed tracking-[0.12em] uppercase drop-shadow-md">
          Criando memórias <br className="sm:hidden" /> Que nunca serão esquecidas
        </p>

        <div className="flex flex-col items-start gap-1 opacity-60">
          <span className="text-white/40 uppercase tracking-[0.6em] font-black text-[8px] sm:text-[9px] select-none">
            Conheça nosso trabalho
          </span>
          <div className="w-8 h-0.5 bg-blue-500/40 rounded-full" />
        </div>
      </div>

      <style>{`
        .radial-vignette {
          background: radial-gradient(circle at center, transparent 0%, rgba(11, 25, 41, 0.2) 50%, rgba(11, 25, 41, 0.95) 100%);
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
      `}</style>
    </section>
  );
};
