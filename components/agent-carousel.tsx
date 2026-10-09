"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./agent-carousel.module.css";

export default function AgentCarousel({ children, label = "Agents" }: { children: ReactNode; label?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const items = Children.toArray(children);

  const updateState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateState();
    track.addEventListener("scroll", updateState, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateState) : null;
    observer?.observe(track);
    window.addEventListener("resize", updateState);
    return () => {
      track.removeEventListener("scroll", updateState);
      observer?.disconnect();
      window.removeEventListener("resize", updateState);
    };
  }, [updateState, items.length]);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const step = firstCard ? firstCard.offsetWidth + 22 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByCard(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByCard(-1);
    }
  }

  return (
    <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={trackRef}
        className={styles.track}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-live="polite"
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${items.length}`}
          >
            {item}
          </div>
        ))}
      </div>

      {(canPrev || canNext) && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scrollByCard(-1)}
            disabled={!canPrev}
            aria-label="Previous agent"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => scrollByCard(1)}
            disabled={!canNext}
            aria-label="Next agent"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
