import React, { useState, useEffect } from "react";
import { useRouter } from "../lib/router";
import { NavbarDesktopLinks, NavbarMobilePanel } from "./publicSite/NavbarParts";
import type { MenuItem } from "./publicSite/NavbarParts";

const spider = "/images/spider.PNG";

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
              <img src={spider} alt="Herói da Cidade" className="h-full w-full scale-125 object-cover" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:tracking-wide whitespace-nowrap">
              Herói da Cidade
            </span>
          </div>

          {/* ========================================================= */}
          {/* DESKTOP: Navegação clássica inalterada (md:flex)         */}
          {/* ========================================================= */}
          <NavbarDesktopLinks navigate={navigate} />

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
        <NavbarMobilePanel onClose={() => setIsMenuOpen(false)} onItemClick={handleMenuClick} />
      )}
    </>
  );
};
