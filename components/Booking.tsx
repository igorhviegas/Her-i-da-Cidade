
import React, { useEffect } from 'react';

export const Booking: React.FC = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <section id="booking" className="py-24 px-4 sm:px-6 bg-gradient-to-b from-black to-[#0B1929] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 rounded-full border border-blue-600/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Base de Operações Online</span>
          </div>
          <h3 className="text-4xl md:text-6xl font-extrabold uppercase italic tracking-tighter mb-6 leading-none">
            Agende Sua <br className="sm:hidden" /> <span className="text-white/40">Chamada de Vídeo</span>
          </h3>
          <p className="text-white/60 max-w-2xl mx-auto font-light text-sm md:text-base leading-relaxed">
            Escolha um horário abaixo para uma experiência imersiva com o Herói da Cidade. 
            Nossa base secreta está pronta para a conexão!
          </p>
        </div>

        <div className="relative">
          <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-blue-600/30 rounded-tl-2xl hidden sm:block" />
          <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-blue-600/30 rounded-br-2xl hidden sm:block" />
          
          <div className="bg-[#0B1929]/40 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.005] duration-500">
            <div className="p-1 sm:p-2 bg-gradient-to-b from-white/10 to-transparent">
              <div 
                className="calendly-inline-widget w-full rounded-2xl overflow-hidden" 
                data-url="https://calendly.com/heroidacidade/video-chamada-espetacular" 
                style={{ minWidth: '320px', height: '700px' }}
              ></div>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
             <div className="flex items-center gap-3">
                <svg className="w-5 h-5 sm:w-4 sm:h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white">Protocolo Seguro</span>
             </div>
             <div className="hidden sm:block w-px h-4 bg-white/20" />
             <div className="flex items-center gap-3">
                <svg className="w-5 h-5 sm:w-4 sm:h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white">Conexão Criptografada</span>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
};
