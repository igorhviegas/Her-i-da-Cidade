import React, { useRef, useState, useEffect } from "react";
import { Review } from "../types";
import { fetchLiveReviews } from "../services/aiService";

export const Feedbacks: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const googleIconUrl = "https://maps.app.goo.gl/Tfb9LL7Byjj8n81U9";
  const googleMapsUrl =
    "https://www.google.com/maps/place/Homem+Aranha+Betim+e+BH+%7C+Her%C3%B3i+da+Cidade/@-19.9459133,-44.193916,17z/data=!4m8!3m7!1s0x81045a4a84371cb:0x69d497b1585d3cae!8m2!3d-19.9459133!4d-44.193916!9m1!1b1!16s%2Fg%2F11pz28s9j4?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDEwNC4wIKXMDSoASAFQAw%3D%3D";
  const shareGoogleUrl =
    "https://www.google.com/maps/place/Homem+Aranha+Betim+e+BH+%7C+Her%C3%B3i+da+Cidade/@-19.9459133,-44.193916,17z/data=!4m8!3m7!1s0x81045a4a84371cb:0x69d497b1585d3cae!8m2!3d-19.9459133!4d-44.193916!9m1!1b1!16s%2Fg%2F11pz28s9j4?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDEwNC4wIKXMDSoASAFQAw%3D%3D";

  useEffect(() => {
    const loadReviews = async () => {
      setLoading(true);
      const data = await fetchLiveReviews();
      setReviews(data);
      setLoading(false);
    };
    loadReviews();
  }, []);

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-red-500",
      "bg-yellow-600",
      "bg-green-600",
      "bg-purple-500",
      "bg-pink-500",
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 bg-white/5 p-8 rounded-3xl border border-white/10">
          <div className="flex items-center gap-6">
            <a
              href={googleIconUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-3 rounded-2xl shadow-xl hover:scale-110 transition-transform cursor-pointer group"
              title="Ver no Google"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </a>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl font-black text-white">5.0</span>
                <div className="flex gap-0.5 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                Baseado em 350+ avaliações no Google
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-full md:w-[400px] bg-white/5 p-8 rounded-2xl border border-white/5 animate-pulse"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-white/10" />
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-white/10 rounded" />
                      <div className="w-20 h-3 bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-3 bg-white/10 rounded" />
                    <div className="w-full h-3 bg-white/10 rounded" />
                    <div className="w-2/3 h-3 bg-white/10 rounded" />
                  </div>
                </div>
              ))
            : reviews.map((review) => (
                <a
                  key={review.id}
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex-shrink-0 w-full md:w-[400px] bg-[#1a2a40]/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 snap-start hover:border-blue-500/30 hover:bg-[#1a2a40]/50 transition-all block"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-transparent group-hover:border-blue-500 transition-all shadow-inner ${getAvatarColor(
                          review.author
                        )}`}
                      >
                        {getInitials(review.author)}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">
                          {review.author}
                        </h4>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3 h-3 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-white/10"
                              }`}
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-[#4285F4] opacity-50 group-hover:opacity-100 transition-opacity">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-white/70 italic leading-relaxed font-light mb-6">
                    "{review.comment}"
                  </p>
                  <div className="flex items-center justify-between opacity-50 text-[10px] font-bold uppercase tracking-widest border-t border-white/5 pt-4">
                    <span>Google Review</span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                      Verificado
                    </span>
                  </div>
                </a>
              ))}
        </div>
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
