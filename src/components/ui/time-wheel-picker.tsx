import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Mobile-friendly scroll-wheel time picker (HH + MM, 24 h, 5-min steps).
// Pure CSS scroll snap — no extra deps. Each column is a vertical scroller
// where the centered item is the selected value.

const ITEM_HEIGHT = 36; // px

interface Props {
  value: string | null | undefined; // "HH:mm"
  onChange: (next: string) => void;
  minuteStep?: number; // default 5
  className?: string;
}

export function TimeWheelPicker({ value, onChange, minuteStep = 5, className }: Props) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep);

  const parsed = parseTime(value);
  const selectedH = parsed?.h ?? 8;
  const selectedM = roundToStep(parsed?.m ?? 0, minuteStep);

  return (
    <div className={cn("relative flex items-center justify-center gap-2 select-none", className)}>
      {/* Highlight band over the centered row */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-9 rounded-md bg-accent/40 border-y border-border"
        aria-hidden
      />
      <Wheel
        items={hours.map((h) => String(h).padStart(2, "0"))}
        selectedIndex={hours.indexOf(selectedH)}
        onSelectIndex={(i) => onChange(formatTime(hours[i], selectedM))}
        ariaLabel="Heures"
      />
      <span className="text-lg font-semibold text-foreground">:</span>
      <Wheel
        items={minutes.map((m) => String(m).padStart(2, "0"))}
        selectedIndex={minutes.indexOf(selectedM)}
        onSelectIndex={(i) => onChange(formatTime(selectedH, minutes[i]))}
        ariaLabel="Minutes"
      />
    </div>
  );
}

// ─── Single column ───
function Wheel({
  items,
  selectedIndex,
  onSelectIndex,
  ariaLabel,
}: {
  items: string[];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<number | null>(null);

  // Keep DOM scroll position in sync with prop value
  useEffect(() => {
    const el = ref.current;
    if (!el || selectedIndex < 0) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      // Snap precisely
      const target = clamped * ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - target) > 0.5) el.scrollTo({ top: target });
      if (clamped !== selectedIndex) onSelectIndex(clamped);
    }, 80);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      className="relative h-[108px] w-16 overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      style={{ scrollPaddingTop: ITEM_HEIGHT, scrollPaddingBottom: ITEM_HEIGHT }}
    >
      {/* Top spacer so first item can center */}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
      {items.map((label, i) => (
        <button
          type="button"
          key={label}
          onClick={() => onSelectIndex(i)}
          className={cn(
            "block w-full snap-center text-center text-base tabular-nums",
            i === selectedIndex ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
          style={{ height: ITEM_HEIGHT, lineHeight: `${ITEM_HEIGHT}px` }}
        >
          {label}
        </button>
      ))}
      {/* Bottom spacer */}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
    </div>
  );
}

// ─── helpers ───
function parseTime(v: string | null | undefined): { h: number; m: number } | null {
  if (!v) return null;
  const m = v.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}
function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function roundToStep(m: number, step: number): number {
  return Math.round(m / step) * step;
}
