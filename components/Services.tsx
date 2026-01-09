import React, { useRef, useState, useEffect, useCallback } from "react";
import { SERVICES } from "../constants";
import { ServiceCard } from "./ServiceCard";

export const Services: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const children = Array.from(
      container.querySelectorAll(".snap-start")
    ) as HTMLElement[];
    if (children.length === 0) return;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let bestIndex = 0;
    let minDist = Infinity;
    children.forEach((child, idx) => {
      const rect = child.getBoundingClientRect();
      const childCenter = rect.left + rect.width / 2;
      const dist = Math.abs(childCenter - containerCenter);
      if (dist < minDist) {
        minDist = dist;
        bestIndex = idx;
      }
    });
    setActiveIndex(bestIndex);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // call initially
    handleScroll();
    const onScroll = () => requestAnimationFrame(handleScroll);
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      container.removeEventListener("scroll", onScroll as EventListener);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  return (
    <section
      id="services"
      className="py-16 sm:py-24 px-4 sm:px-6 max-w-[1440px] mx-auto overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 sm:mb-20 gap-8">
        <div className="max-w-2xl">
          <h2 className="text-[10px] sm:text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-3 sm:mb-4">
            Nossos serviços
          </h2>
          <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase italic tracking-tighter leading-none">
            Escolha Sua <br className="sm:hidden" />{" "}
            <span className="text-white/40">Próxima Missão</span>
          </h3>
        </div>
        <p className="text-white/60 max-w-md text-lg sm:text-xl md:text-2xl font-light leading-tight md:text-right italic">
          Cada vídeo é feito com qualidade e o carinho de uma equipe que ama o
          que faz, para que a magia seja transformada em boas memórias.
        </p>
      </div>

      <div
        ref={containerRef}
        className="flex overflow-x-auto pb-8 gap-4 snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 md:gap-6 md:overflow-visible md:pb-0 scrollbar-hide"
      >
        {SERVICES.map((service) => (
          <div
            key={service.id}
            className="min-w-[85vw] xs:min-w-[45vw] md:min-w-0 snap-start snap-always"
          >
            <ServiceCard service={service} />
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5 mt-4 md:hidden">
        {SERVICES.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === activeIndex ? "w-4 bg-blue-500" : "w-1 bg-white/20"
            }`}
          />
        ))}
      </div>

      <div className="mt-20 flex flex-col items-center">
        <div className="flex items-center gap-6 px-10 py-5 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm group hover:border-blue-500/30 transition-colors shadow-2xl">
          <div className="relative">
            <svg
              className="w-12 h-12 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-black uppercase tracking-widest text-white">
              Não utilizamos I.A.
            </span>
            <span className="text-xs sm:text-sm font-bold text-white/40 uppercase tracking-tighter">
              Atuação e Edição real
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
