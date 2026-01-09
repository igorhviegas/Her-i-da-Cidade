
import React from 'react';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  const whatsappUrl = `https://wa.me/5531999044206?text=${encodeURIComponent('Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ' + service.title)}`;

  return (
    <a 
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative cursor-pointer perspective-1000 w-full block outline-none"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-white/10 transition-all duration-500 sm:group-hover:scale-105 sm:group-hover:border-white/50 sm:group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
        {/* Image */}
        <img 
          src={service.imageUrl} 
          alt={service.title} 
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 sm:group-hover:scale-110"
        />
        
        {/* Overlay - Desktop Hover / Mobile Interaction */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1929] via-[#0B1929]/70 to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6 sm:p-6">
          <p className="text-blue-500 text-sm sm:text-[10px] font-black uppercase mb-1 tracking-widest">{service.category}</p>
          <h3 className="text-2xl sm:text-xl font-bold mb-2 leading-tight text-white">{service.title}</h3>
          <p className="text-base sm:text-sm text-white/80 line-clamp-4 sm:line-clamp-3 mb-4 font-light leading-snug">{service.description}</p>
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
            <span className="font-bold text-xl sm:text-lg text-white">{service.price}</span>
            <span 
              className="w-full xs:w-auto bg-white text-black text-sm sm:text-[10px] font-black px-6 py-3 rounded uppercase tracking-tighter sm:group-hover:bg-blue-600 sm:group-hover:text-white transition-colors text-center"
            >
              Contratar
            </span>
          </div>
        </div>

        {/* Static View - Default for mobile */}
        <div className="absolute bottom-0 left-0 w-full p-5 sm:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent sm:group-hover:hidden transition-all">
            <h3 className="text-xl sm:text-sm font-bold truncate text-white mb-2">{service.title}</h3>
            <div className="flex justify-between items-center">
              <p className="text-sm sm:text-[10px] text-blue-500 font-extrabold uppercase tracking-tighter">{service.price}</p>
              <span className="text-xs sm:text-[8px] text-white/50 uppercase font-black tracking-widest">{service.category}</span>
            </div>
        </div>
      </div>
    </a>
  );
};
