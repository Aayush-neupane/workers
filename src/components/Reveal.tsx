import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";

/** Fade-up on first scroll into view. No-op under reduced-motion. */
export function Reveal({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          gsap.fromTo(
            el,
            { y: 22, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.55, ease: "power2.out", overwrite: true },
          );
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
