import React from "react";

export const Footer: React.FC = () => {
  const socialLinks = [
    {
      name: "Instagram",
      url: "https://www.instagram.com/oheroidacidade/",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    {
      name: "WhatsApp",
      url: "https://wa.me/5531999044206",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.057 3.505c-1.393-1.077-3.193-1.72-5.163-1.72-4.48 0-8.113 3.633-8.113 8.113 0 1.586.452 3.066 1.233 4.318l-1.554 5.672 5.811-1.524c1.205.656 2.583 1.034 4.053 1.034 4.48 0 8.113-3.633 8.113-8.113 0-2.128-.819-4.066-2.163-5.513l-.217-.267zm-5.163 12.914c-1.282 0-2.47-.333-3.504-.916l-.251-.141-3.483.913.929-3.393-.154-.246c-.636-1.018-.999-2.221-.999-3.513 0-3.593 2.923-6.516 6.516-6.516 1.741 0 3.374.678 4.6 1.904s1.904 2.859 1.904 4.612c0 3.593-2.923 6.516-6.516 6.516zm3.562-4.881c-.195-.097-1.151-.568-1.33-.633-.178-.065-.308-.097-.438.097-.13.195-.503.633-.617.763-.114.13-.227.146-.422.049-.195-.097-.822-.303-1.566-.967-.58-.517-.971-1.155-1.084-1.35-.114-.195-.012-.3-.11-.397-.087-.087-.195-.227-.292-.341-.097-.114-.13-.195-.195-.325-.065-.13-.032-.244.016-.341.049-.097.438-1.056.519-1.233.081-.178.114-.308.065-.406-.049-.097-.438-1.056-.601-1.446-.159-.38-.344-.328-.438-.328-.114-.002-.244-.002-.374-.002-.13 0-.341.049-.519.244-.178.195-.682.666-.682 1.625 0 .959.698 1.885.795 2.015.097.13 1.374 2.098 3.328 2.941.464.2 1.056.32 1.574.484.469.149.897.128 1.235.078.377-.056 1.151-.471 1.314-.926.162-.455.162-.845.114-.926-.049-.081-.178-.13-.374-.227z" />
        </svg>
      ),
    },
    {
      name: "YouTube",
      url: "https://www.youtube.com/@oheroidacidade",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
        </svg>
      ),
    },
    {
      name: "TikTok",
      url: "https://www.tiktok.com/@heroidacidade",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.81-.74-3.94-1.69-.17-.15-.33-.3-.48-.46v5.91c0 1.51-.43 2.98-1.21 4.23-.78 1.25-1.92 2.22-3.26 2.77-1.34.55-2.83.73-4.26.51-1.44-.22-2.77-.85-3.85-1.81-1.08-.96-1.87-2.2-2.28-3.57-.41-1.37-.43-2.84-.04-4.22.39-1.38 1.21-2.62 2.34-3.54 1.13-.92 2.53-1.48 3.99-1.61.1-.01.2-.02.3-.02 0 1.29 0 2.58.01 3.88-1.29.14-2.49.88-3.13 1.99-.64 1.11-.71 2.47-.21 3.64.51 1.17 1.52 2.05 2.77 2.39 1.25.34 2.59.13 3.69-.58 1.1-0.71 1.83-1.88 2.02-3.2.02-.12.02-.24.03-.36V.02z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="bg-black pt-24 pb-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 mb-16">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-[#0072d2] rounded-full flex items-center justify-center shadow-lg shadow-blue-600/10 overflow-hidden">
                <img
                  src="/spider.PNG"
                  alt="logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <span className="text-xl font-extrabold tracking-tighter uppercase text-white">
                O Herói <span className="text-blue-500">da Cidade</span>
              </span>
            </div>
            <p className="text-white/50 text-sm mb-8 leading-relaxed max-w-sm">
              Criando memórias que nunca serão esquecidas.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all text-white active:scale-90"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold uppercase tracking-widest text-xs mb-8 text-white">
                Navegação
              </h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li>
                  <a
                    href="#services"
                    className="hover:text-white transition-colors"
                  >
                    Nossos Serviços
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="hover:text-white transition-colors"
                  >
                    Sobre o QG
                  </a>
                </li>
                <li>
                  <a
                    href="#feedbacks"
                    className="hover:text-white transition-colors"
                  >
                    Depoimentos
                  </a>
                </li>
                <li>
                  <a
                    href="#booking"
                    className="hover:text-white transition-colors"
                  >
                    Agendamentos
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-widest text-xs mb-8 text-white">
                Suporte
              </h4>
              <ul className="space-y-4 text-sm text-white/50">
                <li>
                  <a
                    href="https://wa.me/5531999044206"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    Contato Direto
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} O Herói da Cidade. Todos os direitos
            reservados.
          </p>
          <p className="text-center md:text-right">
            Desenvolvido com tecnologia Stark
          </p>
        </div>
      </div>
    </footer>
  );
};
