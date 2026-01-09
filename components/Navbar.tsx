import React, { useState, useEffect } from "react";

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0B1929]/95 backdrop-blur-md border-b border-white/10 py-3"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="w-10 h-10 bg-[#0072d2] rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 overflow-hidden">
            <img src="/spider.PNG" alt="H" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-xl font-extrabold tracking-tighter uppercase hidden sm:block text-white">
            O Herói <span className="text-blue-500">da Cidade</span>
          </span>
        </div>

        <div className="flex items-center gap-6 sm:gap-8 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/70">
          <a href="#services" className="hover:text-white transition-colors">
            Serviços
          </a>
          <a href="#about" className="hover:text-white transition-colors">
            Sobre
          </a>
          <a
            href="https://www.instagram.com/oheroidacidade/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors text-right sm:text-left"
          >
            Instagram
          </a>
        </div>
      </div>
    </nav>
  );
};
