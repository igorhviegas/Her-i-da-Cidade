import React, { useRef, useState, useEffect } from "react";
import { fetchGoogleReviews, type GoogleReviews } from "../services/reviewsService";
import { FeedbacksHeader, ReviewCard, ReviewSkeleton } from "./publicSite/FeedbackParts";

export const Feedbacks: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GoogleReviews | null>(null);
  const [loading, setLoading] = useState(true);

  const googleIconUrl = "https://maps.app.goo.gl/Tfb9LL7Byjj8n81U9";
  const googleMapsUrl =
    "https://www.google.com/maps/place/Homem+Aranha+Betim+e+BH+%7C+Her%C3%B3i+da+Cidade/@-19.9459133,-44.193916,17z/data=!4m8!3m7!1s0x81045a4a84371cb:0x69d497b1585d3cae!8m2!3d-19.9459133!4d-44.193916!9m1!1b1!16s%2Fg%2F11pz28s9j4?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDEwNC4wIKXMDSoASAFQAw%3D%3D";
  const shareGoogleUrl =
    "https://www.google.com/maps/place/Homem+Aranha+Betim+e+BH+%7C+Her%C3%B3i+da+Cidade/@-19.9459133,-44.193916,17z/data=!4m8!3m7!1s0x81045a4a84371cb:0x69d497b1585d3cae!8m2!3d-19.9459133!4d-44.193916!9m1!1b1!16s%2Fg%2F11pz28s9j4?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDEwNC4wIKXMDSoASAFQAw%3D%3D";

  useEffect(() => {
    const loadReviews = async () => {
      setData(await fetchGoogleReviews());
      setLoading(false);
    };
    loadReviews();
  }, []);

  const reviews = data?.reviews ?? [];

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth
          : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  return (
    <section
      id="feedbacks"
      className="py-24 overflow-hidden border-t border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6">
        <FeedbacksHeader
          googleIconUrl={googleIconUrl}
          rating={data?.rating}
          count={data?.count}
          onScroll={reviews.length ? scroll : undefined}
        />

        {/* Falhou ou sem avaliações: sem carrossel (nada inventado), só o link para o Google. */}
        {(loading || reviews.length > 0) && (
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {loading
              ? [...Array(4)].map((_, i) => <ReviewSkeleton key={i} />)
              : reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} href={googleMapsUrl} />
                ))}
          </div>
        )}
        <div className="mt-12 text-center">
          <a
            href={shareGoogleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-white/40 hover:text-white text-xs font-black uppercase tracking-[0.3em] transition-colors border-b border-white/10 pb-1"
          >
            Ver todas as avaliações no Google
          </a>
        </div>
      </div>
    </section>
  );
};
