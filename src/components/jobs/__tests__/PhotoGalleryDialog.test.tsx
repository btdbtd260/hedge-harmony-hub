// ============================================================
// Tests for PhotoGalleryDialog — full-screen photo lightbox
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Mocks (using vi.hoisted so they're available in vi.mock factories) ───

const { createMockEmblaApiForTest } = vi.hoisted(() => {
  // These are defined inside vi.hoisted, so they exist before vi.mock runs
  const mockScrollTo = vi.fn();
  const mockScrollPrev = vi.fn();
  const mockScrollNext = vi.fn();
  const mockSelectedScrollSnap = vi.fn().mockReturnValue(0);
  const mockOn = vi.fn();
  const mockOff = vi.fn();
  const mockCanScrollPrev = vi.fn().mockReturnValue(true);
  const mockCanScrollNext = vi.fn().mockReturnValue(true);

  return {
    createMockEmblaApiForTest: () => ({
      scrollTo: mockScrollTo,
      scrollPrev: mockScrollPrev,
      scrollNext: mockScrollNext,
      selectedScrollSnap: mockSelectedScrollSnap,
      canScrollPrev: mockCanScrollPrev,
      canScrollNext: mockCanScrollNext,
      on: mockOn,
      off: mockOff,
      reInit: vi.fn(),
      slideNodes: vi.fn().mockReturnValue([]),
      scrollSnapList: vi.fn().mockReturnValue([]),
      internalEngine: null,
      destroyed: false,
      plugins: [],
      scrollBody: { scrollDistance: vi.fn() },
      location: { addListener: vi.fn() },
      translate: { to: vi.fn() },
      containerNode: () => null,
      containerRect: () => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }),
      scrollProgress: () => 0,
      scrollSnapList: () => [],
      slidesInView: () => [],
      slideRegistry: () => [],
      activeIndex: () => 0,
      previousScrollSnap: () => 0,
      destroy: vi.fn(),
    }),
  };
});

vi.mock("embla-carousel-react", () => {
  const mockApi = createMockEmblaApiForTest();
  return {
    default: () => [vi.fn(), mockApi],
    __esModule: true,
  };
});

// Mock Radix Dialog primitives — simple pass-through for rendering tests
vi.mock("@radix-ui/react-dialog", () => {
  const DialogRoot = ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog-root" data-open={String(open)}>
        {typeof children === "function"
          ? children({ close: () => onOpenChange?.(false) })
          : children}
      </div>
    ) : null;
  DialogRoot.displayName = "DialogRoot";

  const DialogPortal = ({ children }: any) => (
    <div data-testid="dialog-portal">{children}</div>
  );
  DialogPortal.displayName = "DialogPortal";

  const DialogOverlay = React.forwardRef(
    ({ children, className, ...props }: any, ref: any) => (
      <div
        ref={ref}
        data-testid="dialog-overlay"
        className={className}
        {...props}
      />
    ),
  );
  DialogOverlay.displayName = "DialogOverlay";

  const DialogContent = React.forwardRef(
    ({ children, className, ...props }: any, ref: any) => (
      <div
        ref={ref}
        data-testid="dialog-content"
        className={className}
        {...props}
      >
        {children}
      </div>
    ),
  );
  DialogContent.displayName = "DialogContent";

  const DialogClose = React.forwardRef(
    ({ children, asChild, ...props }: any, ref: any) => (
      <button ref={ref} data-testid="dialog-close" {...props}>
        {children}
      </button>
    ),
  );
  DialogClose.displayName = "DialogClose";

  const DialogTitle = ({ children, className }: any) => (
    <div data-testid="dialog-title" className={className}>
      {children}
    </div>
  );
  DialogTitle.displayName = "DialogTitle";

  const DialogDescription = ({ children, className }: any) => (
    <div data-testid="dialog-description" className={className}>
      {children}
    </div>
  );
  DialogDescription.displayName = "DialogDescription";

  return {
    Root: DialogRoot,
    Portal: DialogPortal,
    Overlay: DialogOverlay,
    Content: DialogContent,
    Close: DialogClose,
    Title: DialogTitle,
    Description: DialogDescription,
    Trigger: ({ children }: any) => children,
  };
});

// Mock lucide-react icons used in the component
vi.mock("lucide-react", () => ({
  X: () => <span data-testid="icon-x">✕</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">‹</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">›</span>,
}));

// ─── Test data ───

const mockPhotos = [
  { url: "https://example.com/before1.jpg", kind: "before" as const },
  { url: "https://example.com/before2.jpg", kind: "before" as const },
  { url: "https://example.com/after1.jpg", kind: "after" as const },
  { url: "https://example.com/after2.jpg", kind: "after" as const },
];

// ─── Import after mocks are set up ───

import { PhotoGalleryDialog } from "../PhotoGalleryDialog";

describe("PhotoGalleryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open is false", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();
  });

  it("renders the dialog when open is true", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });

  it("shows Avant, Après, and Toutes tab buttons", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText("Avant")).toBeInTheDocument();
    expect(screen.getByText("Après")).toBeInTheDocument();
    expect(screen.getByText("Toutes")).toBeInTheDocument();
  });

  it("shows a photo counter with correct total in Toutes tab (default)", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // Expect "1 / 4" — 1-indexed, 4 total
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });

  it("starts at the given initialIndex", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={2}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // initialIndex 2 → 3rd photo → counter shows "3 / 4"
    expect(screen.getByText(/3 \/ 4/)).toBeInTheDocument();
  });

  it("has a visible close button", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
  });

  it("has left and right navigation arrow buttons", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("icon-chevron-left")).toBeInTheDocument();
    expect(screen.getByTestId("icon-chevron-right")).toBeInTheDocument();
  });

  it("filters to only before photos when Avant tab is clicked", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Avant"));
    // Only 2 before photos → "1 / 2"
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it("filters to only after photos when Après tab is clicked", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Après"));
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it("shows all photos when Toutes tab is clicked after filtering", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // Switch to Avant then back to Toutes
    fireEvent.click(screen.getByText("Avant"));
    fireEvent.click(screen.getByText("Toutes"));
    expect(screen.getByText(/1 \/ 4/)).toBeInTheDocument();
  });

  it("switching tabs does not close the dialog", () => {
    const onOpenChange = vi.fn();
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText("Avant"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });

  it("handles an empty photos array gracefully", () => {
    render(
      <PhotoGalleryDialog
        photos={[]}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    // Should show empty state message
    expect(screen.getByText("Aucune photo")).toBeInTheDocument();
  });

  it("handles initialIndex beyond photo count", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={999}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // Should clamp to last photo → "4 / 4"
    expect(screen.getByText(/4 \/ 4/)).toBeInTheDocument();
  });

  it("renders images for each photo in Toutes view", () => {
    render(
      <PhotoGalleryDialog
        photos={mockPhotos}
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(4);
    expect(images[0]).toHaveAttribute(
      "src",
      "https://example.com/before1.jpg",
    );
    expect(images[2]).toHaveAttribute(
      "src",
      "https://example.com/after1.jpg",
    );
  });
});
