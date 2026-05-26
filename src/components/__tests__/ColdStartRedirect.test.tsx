// ============================================================
// Tests for ColdStartRedirect — mobile cold-start route reset
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import React from "react";

// ─── Helper: renders Dashboard stub ───
function DashboardPage() {
  return <div data-testid="page-dashboard">Dashboard</div>;
}

// ─── Helper: renders Messagerie stub ───
function MessageriePage() {
  return <div data-testid="page-messagerie">Messagerie</div>;
}

// ─── Helper: component that shows current path (for redirect detection) ───
function PathDisplay() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

// ─── Hoisted mock helpers ───
const { mockIsMobileRef } = vi.hoisted(() => ({
  mockIsMobileRef: { current: false },
}));

// ─── Mock useIsMobile ───
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobileRef.current,
}));

// ─── Import AFTER mocks ───
import { ColdStartRedirect } from "../ColdStartRedirect";

// ─── Test wrapper ───
function TestApp({
  initialEntries = ["/"],
}: {
  initialEntries?: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ColdStartRedirect />
      <Routes>
        <Route path="/" element={<><DashboardPage /><PathDisplay /></>} />
        <Route path="/messagerie" element={<><MessageriePage /><PathDisplay /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ColdStartRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobileRef.current = false;
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("mobile cold start", () => {
    it("shows Dashboard on fresh load at /", () => {
      mockIsMobileRef.current = true;

      render(<TestApp initialEntries={["/"]} />);

      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
      expect(screen.getByTestId("current-path")).toHaveTextContent("/");
    });

    it("redirects /messagerie to Dashboard on cold start", () => {
      mockIsMobileRef.current = true;

      render(<TestApp initialEntries={["/messagerie"]} />);

      // After cold-start redirect, Dashboard should render
      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
      expect(screen.getByTestId("current-path")).toHaveTextContent("/");
    });

    it("does NOT redirect if sessionStorage already has flag", () => {
      mockIsMobileRef.current = true;
      sessionStorage.setItem("hh_session_started", "true");

      render(<TestApp initialEntries={["/messagerie"]} />);

      // Session already started — stay on Messagerie
      expect(screen.getByTestId("page-messagerie")).toBeInTheDocument();
      expect(screen.getByTestId("current-path")).toHaveTextContent("/messagerie");
    });
  });

  describe("desktop behavior", () => {
    it("shows Messagerie on direct load at /messagerie (desktop cold start)", () => {
      mockIsMobileRef.current = false;

      render(<TestApp initialEntries={["/messagerie"]} />);

      // Not mobile — no redirect
      expect(screen.getByTestId("page-messagerie")).toBeInTheDocument();
      expect(screen.getByTestId("current-path")).toHaveTextContent("/messagerie");
    });

    it("shows Dashboard on fresh load at / (desktop)", () => {
      mockIsMobileRef.current = false;

      render(<TestApp initialEntries={["/"]} />);

      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("does NOT create an infinite redirect loop", () => {
      mockIsMobileRef.current = true;

      // Render at /messagerie — should redirect to /
      const { rerender } = render(<TestApp initialEntries={["/messagerie"]} />);

      // After redirect, Dashboard should render
      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();

      // Simulate a re-render (e.g., by React strict mode)
      rerender(<TestApp initialEntries={["/messagerie"]} />);

      // Still at Dashboard — no redirect loop
      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
    });

    it("marks session as started to prevent repeated redirects", () => {
      mockIsMobileRef.current = true;

      render(<TestApp initialEntries={["/messagerie"]} />);

      // Should have set sessionStorage
      expect(sessionStorage.getItem("hh_session_started")).toBe("true");
    });

    it("preserves sessionStorage flag between renders", () => {
      mockIsMobileRef.current = true;

      const { rerender } = render(<TestApp initialEntries={["/messagerie"]} />);

      // After first render, flag is set
      expect(sessionStorage.getItem("hh_session_started")).toBe("true");

      // Simulate a component re-render (React re-render, not navigation)
      rerender(<TestApp initialEntries={["/messagerie"]} />);

      // Should still have the flag
      expect(sessionStorage.getItem("hh_session_started")).toBe("true");
      // Should still show Dashboard (the redirect already happened)
      expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();
    });
  });
});
