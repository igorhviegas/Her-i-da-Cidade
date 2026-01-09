
import React, { useState, useEffect } from 'react';

export const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [showSplat, setShowSplat] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    if (isShooting) return;
    setIsShooting(true);
    setTimeout(() => {
      setShowSplat(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
    setTimeout(() => {
      setIsShooting(false);
      setShowSplat(false);
    }, 1000);
  };

  return (
    <>
      <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-[110] pointer-events-none transition-all duration-300 ${showSplat ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
          <path d="M100 0L120 40M100 0L80 40M100 0L150 20M100 0L50 20M100 0L180 10M100 0L20 10" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="100" cy="5" r="8" fill="white" className="animate-ping" />
          <circle cx="100" cy="5" r="5" fill="white" />
        </svg>
      </div>
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-0 z-[100] pointer-events-none origin-bottom transition-all duration-500 ease-out ${isShooting ? 'h-screen opacity-100' : 'h-0 opacity-0'}`} style={{ width: '4px' }}>
        <div className="absolute inset-0 bg-gradient-to-t from-blue-400 via-white to-white blur-[1px] shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
           <path d="M2 0 Q -5 250 2 500 Q 9 750 2 1000" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" className="animate-web-wiggle" />
        </svg>
      </div>
      <button onClick={scrollToTop} aria-label="Voltar ao topo" className={`fixed bottom-28 right-8 z-[60] w-14 h-14 bg-[#0072d2]/20 backdrop-blur-xl border border-blue-400/40 rounded-full flex items-center justify-center transition-all duration-500 hover:scale-115 active:scale-90 group shadow-[0_0_30px_rgba(0,114,210,0.3)] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
        <div className={`relative transition-transform duration-300 ${isShooting ? '-translate-y-12 scale-150 rotate-12' : 'group-hover:-translate-y-1'}`}>
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M12 12l-8-4M12 12l8-4M12 12l-8 4M12 12l8 4M12 12L7 4m10 0l-5 8" opacity="0.5" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 8V4M12 16v4" strokeWidth="3" />
          </svg>
        </div>
        <span className={`absolute right-full mr-6 px-4 py-2 bg-white text-blue-900 text-[10px] font-black uppercase tracking-[0.3em] rounded-lg transition-all duration-300 pointer-events-none shadow-xl ${isShooting ? 'opacity-100 -translate-x-2' : 'opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0'}`}>Thwip!</span>
        {isShooting && <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-50" />}
      </button>
      <style>{`
        @keyframes web-wiggle {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        .animate-web-wiggle {
          animation: web-wiggle 0.2s infinite ease-in-out;
        }
      `}</style>
    </>
  );
};
