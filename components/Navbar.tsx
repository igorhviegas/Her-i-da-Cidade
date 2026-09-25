import React, { useState, useEffect } from "react";
import { useRouter } from "../lib/router";

const spider = "/images/spider.PNG";

interface MenuItem {
  label: string;
  href: string;
  type: "anchor" | "route";
  isVideos?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Serviços", href: "#services", type: "anchor" },
  { label: "Vídeos", href: "/videos", type: "route", isVideos: true },
  { label: "Sobre nós", href: "#about", type: "anchor" },
  { label: "Vídeo chamada", href: "#booking", type: "anchor" },
  { label: "Depoimentos", href: "#feedbacks", type: "anchor" },
  { label: "Contatos", href: "#contact", type: "anchor" },
];

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { navigate, path } = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fechar o menu com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  // Fechar menu ao mudar de rota
  useEffect(() => {
    setIsMenuOpen(false);
  }, [path]);

  const handleLogoClick = () => {
    setIsMenuOpen(false);
    if (path !== '/') {
      navigate('/');
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleMenuClick = (item: MenuItem, e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(false);

    if (item.type === "route") {
      navigate(item.href);
      return;
    }

    // Se for âncora
    if (path !== '/') {
      navigate('/' + item.href);
      return;
    }

    const targetElement = document.querySelector(item.href);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled || isMenuOpen
            ? "bg-black/90 backdrop-blur-md shadow-lg py-2.5 sm:py-3"
            : "bg-gradient-to-b from-black/85 to-transparent py-3 sm:py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 flex justify-between items-center">
          {/* Logo / Brand */}
          <div
            className="flex items-center gap-2 cursor-pointer flex-shrink-0"
            onClick={handleLogoClick}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#0072d2] rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 overflow-hidden flex-shrink-0">
              <img src={spider} alt="Herói da Cidade" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:tracking-wide whitespace-nowrap">
              Herói da Cidade
            </span>
          </div>

          {/* ========================================================= */}
          {/* DESKTOP: Navegação clássica inalterada (md:flex)         */}
          {/* ========================================================= */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-bold uppercase tracking-widest text-white/75 flex-shrink-0">
            <a href="#services" className="hover:text-white transition-colors">
              Serviços
            </a>
            <a href="#about" className="hover:text-white transition-colors">
              Sobre
            </a>
            <a
              href="/videos"
              onClick={(e) => {
                e.preventDefault();
                navigate('/videos');
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-600/25 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-600/45 transition-all font-extrabold whitespace-nowrap shadow-sm"
            >
              <svg className="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Vídeos
            </a>
            <a
              href="https://www.instagram.com/oheroidacidade/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 flex-shrink-0"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>Instagram</span>
            </a>
          </div>

          {/* ========================================================= */}
          {/* MOBILE: [▶ VÍDEOS] + [☰ HAMBURGER] (md:hidden)            */}
          {/* ========================================================= */}
          <div className="flex md:hidden items-center gap-2 flex-shrink-0">
            {/* Botão Vídeos em destaque */}
            <a
              href="/videos"
              onClick={(e) => {
                e.preventDefault();
                setIsMenuOpen(false);
                navigate('/videos');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 hover:text-white transition-all font-extrabold text-xs whitespace-nowrap shadow-sm active:scale-95"
            >
              <svg className="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Vídeos</span>
            </a>

            {/* Botão Hamburger acessível (touch target >= 44x44px) */}
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white transition-colors cursor-pointer flex-shrink-0"
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MOBILE MENU DROPDOWN / PANEL                              */}
      {/* ========================================================= */}
      {isMenuOpen && (
        <>
          {/* Backdrop para fechar ao tocar fora */}
          <div
            className="fixed inset-0 top-[56px] sm:top-[64px] bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Painel do menu */}
          <div className="fixed top-[56px] sm:top-[64px] left-0 right-0 z-50 md:hidden bg-[#0A0F1D]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl px-4 py-4 animate-fade-in">
            <nav className="flex flex-col space-y-1">
              {MENU_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleMenuClick(item, e)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    item.isVideos
                      ? "bg-purple-600/20 text-purple-200 border border-purple-500/30 hover:bg-purple-600/30 hover:text-white"
                      : "text-white/80 hover:text-white hover:bg-white/5 active:bg-white/10"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {item.isVideos && (
                      <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                    {item.label}
                  </span>
                  <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
};
