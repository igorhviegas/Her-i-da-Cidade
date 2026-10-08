import React from "react";

export interface MenuItem {
  label: string;
  href: string;
  type: "anchor" | "route";
  isVideos?: boolean;
}

export const MENU_ITEMS: MenuItem[] = [
  { label: "Serviços", href: "#services", type: "anchor" },
  { label: "Vídeos", href: "/videos", type: "route", isVideos: true },
  { label: "Sobre nós", href: "#about", type: "anchor" },
  { label: "Vídeo chamada", href: "#booking", type: "anchor" },
  { label: "Depoimentos", href: "#feedbacks", type: "anchor" },
  { label: "Dúvidas", href: "/duvidas", type: "route" },
  { label: "Contatos", href: "#contact", type: "anchor" },
];

interface NavbarDesktopLinksProps {
  navigate: (path: string) => void;
}

export const NavbarDesktopLinks: React.FC<NavbarDesktopLinksProps> = ({ navigate }) => (
    <div className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-bold uppercase tracking-widest text-white/75 flex-shrink-0">
      <a href="#services" className="hover:text-white transition-colors">
        Serviços
      </a>
      <a href="#about" className="hover:text-white transition-colors">
        Sobre
      </a>
      <a
        href="/duvidas"
        onClick={(e) => {
          e.preventDefault();
          navigate('/duvidas');
        }}
        className="hover:text-white transition-colors"
      >
        Dúvidas
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
);

interface NavbarMobilePanelProps {
  onClose: () => void;
  onItemClick: (item: MenuItem, e: React.MouseEvent) => void;
}

export const NavbarMobilePanel: React.FC<NavbarMobilePanelProps> = ({ onClose, onItemClick }) => (
  <>
      {/* Backdrop para fechar ao tocar fora */}
      <div
        className="fixed inset-0 top-[56px] sm:top-[64px] bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        onClick={() => onClose()}
        aria-hidden="true"
      />

      {/* Painel do menu */}
      <div className="fixed top-[56px] sm:top-[64px] left-0 right-0 z-50 md:hidden bg-[#0A0F1D]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl px-4 py-4 animate-fade-in">
        <nav className="flex flex-col space-y-1">
          {MENU_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => onItemClick(item, e)}
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
);
