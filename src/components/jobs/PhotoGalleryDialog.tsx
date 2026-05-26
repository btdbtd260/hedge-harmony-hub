import { useState, useEffect, useCallback, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───

export interface GalleryPhoto {
  url: string;
  kind: "before" | "after";
}

interface Props {
  photos: GalleryPhoto[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "before" | "after" | "all";

// ─── Constants ───

const TABS: { key: Tab; label: string }[] = [
  { key: "before", label: "Avant" },
  { key: "after", label: "Après" },
  { key: "all", label: "Toutes" },
];

// ─── Component ───

export function PhotoGalleryDialog({ photos, initialIndex, open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  // Filter photos based on active tab
  const filteredPhotos = useMemo(
    () => (tab === "all" ? photos : photos.filter((p) => p.kind === tab)),
    [photos, tab],
  );

  // Compute where the initially-selected photo lands within the filtered set
  const effectiveInitialIndex = useMemo(() => {
    if (filteredPhotos.length === 0) return 0;
    if (tab === "all") return Math.min(initialIndex, photos.length - 1);

    // Find the same photo in the filtered list
    const currentPhoto = photos[initialIndex];
    if (!currentPhoto) return 0;
    const idx = filteredPhotos.findIndex((p) => p.url === currentPhoto.url);
    return idx >= 0 ? idx : 0;
  }, [tab, initialIndex, photos, filteredPhotos]);

  // Embla carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Scroll to effective index when tab changes or dialog opens
  useEffect(() => {
    if (!emblaApi || !open) return;
    const idx = Math.min(effectiveInitialIndex, Math.max(filteredPhotos.length - 1, 0));
    emblaApi.scrollTo(idx);
    setSelectedIndex(idx);
  }, [emblaApi, tab, open, effectiveInitialIndex, filteredPhotos.length]);

  // Track carousel selection changes
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!open || !emblaApi) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi.scrollPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi.scrollNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const total = filteredPhotos.length;
  const current = total > 0 ? selectedIndex + 1 : 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Full-screen dark overlay — higher z-index than parent dialogs */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[60] bg-black/90",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />

        {/* Content — full viewport, no border/padding */}
        <DialogPrimitive.Content
          className="fixed left-0 top-0 z-[60] flex h-full w-full max-w-none flex-col items-center justify-center border-0 bg-transparent p-0 focus:outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          {/* ── Close button — top right ── */}
          <DialogPrimitive.Close className="absolute right-4 top-4 z-20 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/70">
            <X className="h-6 w-6" />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>

          {/* ── Tab buttons — top center ── */}
          <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-1 rounded-lg bg-black/50 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "bg-white text-black"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Photo counter — bottom center ── */}
          {total > 0 && (
            <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white">
              {current} / {total}
            </div>
          )}

          {/* ── Left arrow ── */}
          {total > 1 && (
            <button
              type="button"
              onClick={scrollPrev}
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/70"
              aria-label="Précédente"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* ── Right arrow ── */}
          {total > 1 && (
            <button
              type="button"
              onClick={scrollNext}
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white transition-colors hover:bg-black/70"
              aria-label="Suivante"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* ── Embla carousel ── */}
          {total > 0 ? (
            <div
              key={tab}
              className="flex h-full w-full items-center justify-center overflow-hidden"
            >
              <div
                ref={emblaRef}
                className="flex h-full w-full items-center"
              >
                <div className="flex h-full items-center">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.url}
                      className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-4"
                    >
                      <img
                        src={photo.url}
                        alt={photo.kind === "before" ? "Avant" : "Après"}
                        className="max-h-full max-w-full object-contain"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg text-white/60">
              Aucune photo
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
