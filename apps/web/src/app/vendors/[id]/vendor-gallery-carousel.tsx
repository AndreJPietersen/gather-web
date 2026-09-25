"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CarouselImage {
  id: string;
  url: string;
  caption: string | null;
}

// Full-bleed, swipeable carousel (the vendor's own choice among a few
// layout options) — one large photo at a time with dot indicators, closer
// to a real listing page than a static grid. Native scroll-snap does the
// swipe gesture and momentum for free, no gesture library needed; the
// dots just mirror scroll position via a plain onScroll handler.
export function VendorGalleryCarousel({ images, altBase }: { images: CarouselImage[]; altBase: string }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element -- a Storage
          // public URL isn't a static/optimizable asset next/image can
          // source-check at build time.
          <img
            key={image.id}
            src={image.url}
            alt={image.caption ?? altBase}
            className="h-full w-full flex-shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {images.map((image, i) => (
            <span
              key={image.id}
              className={cn("h-1.5 w-1.5 rounded-full bg-white/60 transition-all", i === index && "w-4 bg-white")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
