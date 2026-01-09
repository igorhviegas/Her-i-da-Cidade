
import React from 'react';

export const About: React.FC = () => {
  const whatsappMessage = encodeURIComponent("Olá, Gostaria de saber mais sobre os serviços do Heroi da Cidade");
  const whatsappUrl = `https://wa.me/5531999044206?text=${whatsappMessage}`;
  const youtubeShortsUrl = "https://youtube.com/shorts/0uohQKcVu6M?si=EFfoOHr_Dz6BS7u-";

  return (
    <section id="about" className="py-24 bg-gradient-to-b from-[#0B1929] to-black border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-900/10 group">
          <img 
            src="https://disciplinary-peach-obfj8i7gqu.edgeone.app/profissional%201.jpeg" 
            alt="Nosso trabalho" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/20">
            <a 
              href={youtubeShortsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              <svg fill="currentColor" className="w-8 h-8 ml-1" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Sobre nós</h2>
          <h3 className="text-4xl font-extrabold uppercase italic tracking-tighter mb-8 leading-none">
            Criando Memórias <br /> <span className="text-white/40">Que Nunca Serão Esquecidas</span>
          </h3>
          <div className="space-y-6 text-white/70 leading-relaxed font-light">
            <p>
              O <strong>Herói da Cidade</strong> nasceu do sonho de um menino  apaixonado pelo "Amigão da Vizinhança", de se tornar um super heroi desde pequeno. Como a principal função de um herói é ajudar as pesssoas, Igor Viegas (nosso Homem-Aranha) descobriu uma maneira divertida de fazer isso. Com os vídeos educativos, conquistou milhares de seguidores e ajudou diversas famílias com as tarefas mais difíceis do desenvolvimento infanti. Somos especializados em entretenimento lúdico e educacional de alta qualidade exclusivamente com o Homem-Aranha.
            </p>
            <p>
              Fora das telinhas, o heroi da Cidade atua em festas infantis com o personagem Homem-Aranha em toda região metropolitana de Belo Horizonte em minas Gerais, incluindo Betim, Contagem, Nova Lima, Lagoa Santa, Igarapé, Ribeirão das neves e muito mais. Fazemos com que até os mais velhos se questionem se o Homem-Aranha realmente existe; Incorporamos os valores, a voz e a presença do herói mais querido. Nosso compromisso é com a emoção genuína e a criação de memórias que duram a vida toda.
            </p>
            <ul className="grid grid-cols-2 gap-4 pt-4 text-white font-bold uppercase text-xs tracking-widest">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Atuação Profissional
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" /> Vídeos exclusivos
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" /> Entrega Rápida
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" /> Máxima qualidade
              </li>
            </ul>
          </div>
          <div className="mt-10">
            <a 
              href={whatsappUrl} 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-white"
            >
              Fale com nossa equipe
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
