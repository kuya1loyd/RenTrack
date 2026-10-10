"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Home, Eye, Camera, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnitImageCarouselProps {
  images?: string[];
  fallbackImage?: string;
  alt: string;
  title?: string;
  subtitle?: string;
  className?: string;
  imageClassName?: string;
  variant?: "thumbnail" | "carousel";
  disableLightbox?: boolean;
}

export default function UnitImageCarousel({
  images = [],
  fallbackImage,
  alt,
  title,
  subtitle,
  className,
  imageClassName,
  variant,
  disableLightbox = false,
}: UnitImageCarouselProps) {
  // Deduplicate and filter non-empty image URLs
  const rawList = images.length > 0 ? images : fallbackImage ? [fallbackImage] : [];
  const allImages = Array.from(
    new Set(rawList.filter((img): img is string => Boolean(img && typeof img === "string" && img.trim())))
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const total = allImages.length;
  const safeIndex = total > 0 ? ((activeIndex % total) + total) % total : 0;
  const hasMultiple = total > 1;

  // Auto-detect thumbnail mode if variant is explicitly "thumbnail" or if className suggests compact dimensions
  const isThumbnail =
    variant === "thumbnail" ||
    (variant !== "carousel" &&
      Boolean(
        className &&
          /\b(h-10|h-12|h-14|h-16|w-12|w-14|w-16|w-20)\b/.test(className)
      ));

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((curr) => (curr - 1 + total) % total);
      } else if (e.key === "ArrowRight") {
        setActiveIndex((curr) => (curr + 1) % total);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, total]);

  if (total === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
          className
        )}
        role="img"
        aria-label={`${alt}: no photo available`}
      >
        <Home className="h-5 w-5" />
        <span className="text-[9px] font-medium uppercase tracking-wide">No photo</span>
      </div>
    );
  }

  const move = (e: React.MouseEvent, direction: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((current) => {
      const next = (current + direction) % total;
      return next < 0 ? next + total : next;
    });
    setImageFailed(false);
  };

  const handleOpenLightbox = (e: React.MouseEvent) => {
    if (disableLightbox || total === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setLightboxOpen(true);
  };

  return (
    <>
      {isThumbnail ? (
        // ── Compact Thumbnail Mode (tables, small cards) ────────────────
        <div
          onClick={handleOpenLightbox}
          className={cn(
            "group relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer transition-all hover:ring-2 hover:ring-blue-500/70 shadow-xs",
            className
          )}
          title={`Click to view all ${total} photos`}
        >
          {imageFailed ? (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-slate-100 text-slate-400 dark:bg-slate-800"
              role="img"
              aria-label={`${alt}: photo unavailable`}
            >
              <Home className="h-4 w-4" />
              <span className="text-[8px] font-medium">Unavailable</span>
            </div>
          ) : (
            <img
              key={allImages[safeIndex]}
              src={allImages[safeIndex]}
              alt={alt}
              onError={() => setImageFailed(true)}
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-110",
                imageClassName
              )}
            />
          )}

          {/* Hover zoom eye overlay */}
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
            <Eye className="h-4 w-4 text-white drop-shadow" />
          </div>

          {/* Clean multiple photos badge */}
          {hasMultiple && (
            <span className="absolute bottom-1 right-1 z-10 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-xs pointer-events-none">
              <Camera className="h-2.5 w-2.5" />
              {total}
            </span>
          )}
        </div>
      ) : (
        // ── Full Card Carousel Mode (large cards, detailed previews) ───
        <div
          onClick={handleOpenLightbox}
          className={cn(
            "group relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 cursor-pointer",
            className
          )}
          title="Click to view full photos in gallery"
        >
          {imageFailed ? (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400 dark:bg-slate-800"
              role="img"
              aria-label={`${alt}: photo unavailable`}
            >
              <Home className="h-8 w-8" />
              <span className="text-xs font-medium uppercase tracking-wide">Photo unavailable</span>
            </div>
          ) : (
            <img
              key={allImages[safeIndex]}
              src={allImages[safeIndex]}
              alt={alt}
              onError={() => setImageFailed(true)}
              className={cn(
                "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
                imageClassName
              )}
            />
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs shadow-lg">
              <Eye className="h-3.5 w-3.5" /> View Gallery ({total})
            </span>
          </div>

          {hasMultiple && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => move(e, -1)}
                className="absolute left-2.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white shadow-md transition-all hover:bg-black/85 hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100 pointer-events-auto"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => move(e, 1)}
                className="absolute right-2.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white shadow-md transition-all hover:bg-black/85 hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100 pointer-events-auto"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 pointer-events-auto">
                {allImages.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    aria-label={`Show image ${index + 1}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveIndex(index);
                      setImageFailed(false);
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all cursor-pointer",
                      index === safeIndex ? "w-3 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                    )}
                  />
                ))}
              </div>
              <div className="absolute bottom-2.5 right-2.5 z-20 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white pointer-events-none backdrop-blur-xs shadow-xs">
                {safeIndex + 1}/{total}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── High-Resolution Photo Gallery Lightbox Modal ────────────────── */}
      {lightboxOpen &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Photo Gallery for ${alt}`}
            className="fixed inset-0 z-[9999] flex flex-col justify-between bg-black/95 p-4 sm:p-6 text-white backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
          >
            {/* Top Bar */}
            <div
              className="flex items-center justify-between z-20 pb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {title || alt}
                </h3>
                {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-xs">
                  Photo {safeIndex + 1} of {total}
                </span>

                <a
                  href={allImages[safeIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  title="Open original image in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="rounded-full bg-white/15 p-2 text-white hover:bg-red-600 transition-colors cursor-pointer"
                  aria-label="Close photo gallery"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Center Main Image Display */}
            <div
              className="relative flex flex-1 items-center justify-center my-2 min-h-0 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {hasMultiple && (
                <button
                  type="button"
                  onClick={(e) => move(e, -1)}
                  className="absolute left-2 sm:left-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white shadow-2xl hover:bg-white/35 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              <img
                key={allImages[safeIndex]}
                src={allImages[safeIndex]}
                alt={`${alt} - photo ${safeIndex + 1}`}
                className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300 select-none"
              />

              {hasMultiple && (
                <button
                  type="button"
                  onClick={(e) => move(e, 1)}
                  className="absolute right-2 sm:right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white shadow-2xl hover:bg-white/35 hover:scale-110 active:scale-95 transition-all cursor-pointer backdrop-blur-xs"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnail Strip */}
            {hasMultiple && (
              <div
                className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-20 max-w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {allImages.map((img, idx) => (
                  <button
                    type="button"
                    key={`${img}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(idx);
                      setImageFailed(false);
                    }}
                    className={cn(
                      "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer shadow-md",
                      idx === safeIndex
                        ? "border-blue-500 ring-2 ring-blue-500/50 scale-105 opacity-100"
                        : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
