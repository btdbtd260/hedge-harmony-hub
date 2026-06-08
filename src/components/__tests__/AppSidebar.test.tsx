// ============================================================
// Tests for AppSidebar — mobile sidebar close-on-navigate fix
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Hoisted mock helpers ───
// These must be defined before vi.mock (which is hoisted).

const { mockSetOpenMobile, mockIsMobileRef } = vi.hoisted(() => ({
  mockSetOpenMobile: vi.fn(),
  mockIsMobileRef: { current: false },
}));

// ─── Mocks ───

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    isMobile: mockIsMobileRef.current,
    setOpenMobile: mockSetOpenMobile,
    state: "expanded",
    open: true,
    setOpen: vi.fn(),
    openMobile: false,
    toggleSidebar: vi.fn(),
  }),
}));

// ─── Mock supabase client (SidebarNavLink does not call supabase directly,
// but AppSidebar module imports hooks that reference supabase) ───

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

// ─── Import after mocks ───

import { SidebarNavLink } from "@/components/AppSidebar";

// ─── Tests ───

describe("SidebarNavLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobileRef.current = false;
  });

  describe("mobile behavior", () => {
    it("calls setOpenMobile(false) when clicked on mobile", () => {
      mockIsMobileRef.current = true;

      render(
        <MemoryRouter initialEntries={["/some-page"]}>
          <SidebarNavLink to="/dashboard" data-testid="nav-dashboard">
            Dashboard
          </SidebarNavLink>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByTestId("nav-dashboard"));

      expect(mockSetOpenMobile).toHaveBeenCalledTimes(1);
      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
    });

    it("closes sidebar for Messagerie link on mobile", () => {
      mockIsMobileRef.current = true;

      render(
        <MemoryRouter initialEntries={["/some-page"]}>
          <SidebarNavLink to="/messagerie" data-testid="nav-messagerie">
            Messagerie
          </SidebarNavLink>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByTestId("nav-messagerie"));

      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
    });

    it("preserves navigation when clicked on mobile", () => {
      mockIsMobileRef.current = true;

      let pathname = "/start";
      render(
        <MemoryRouter initialEntries={["/start"]}>
          <SidebarNavLink to="/target-page">Target Page</SidebarNavLink>
        </MemoryRouter>,
      );

      // Click to navigate
      fireEvent.click(screen.getByText("Target Page"));

      // The link rendered by react-router-dom should have the correct href
      const link = screen.getByText("Target Page").closest("a");
      expect(link).toHaveAttribute("href", "/target-page");
    });
  });

  describe("desktop behavior", () => {
    it("does NOT call setOpenMobile when clicked on desktop", () => {
      mockIsMobileRef.current = false;

      render(
        <MemoryRouter initialEntries={["/some-page"]}>
          <SidebarNavLink to="/dashboard" data-testid="nav-dashboard">
            Dashboard
          </SidebarNavLink>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByTestId("nav-dashboard"));

      expect(mockSetOpenMobile).not.toHaveBeenCalled();
    });

    it("navigates normally on desktop", () => {
      mockIsMobileRef.current = false;

      render(
        <MemoryRouter initialEntries={["/start"]}>
          <SidebarNavLink to="/dashboard">Dashboard</SidebarNavLink>
        </MemoryRouter>,
      );

      const link = screen.getByText("Dashboard").closest("a");
      expect(link).toHaveAttribute("href", "/dashboard");
    });
  });

  describe("edge cases", () => {
    it("preserves custom onClick handler", () => {
      mockIsMobileRef.current = true;
      const customOnClick = vi.fn();

      render(
        <MemoryRouter initialEntries={["/start"]}>
          <SidebarNavLink to="/dashboard" onClick={customOnClick}>
            Dashboard
          </SidebarNavLink>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByText("Dashboard"));

      // Both custom onClick AND setOpenMobile should be called
      expect(customOnClick).toHaveBeenCalledTimes(1);
      expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
    });

    it("handles undefined activeClassName gracefully", () => {
      mockIsMobileRef.current = true;

      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <SidebarNavLink to="/dashboard">Dashboard</SidebarNavLink>
        </MemoryRouter>,
      );

      const link = screen.getByText("Dashboard").closest("a");
      expect(link).toBeInTheDocument();
    });

    it("supports activeClassName prop", () => {
      mockIsMobileRef.current = false;

      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <SidebarNavLink to="/dashboard" activeClassName="text-primary font-medium">
            Dashboard
          </SidebarNavLink>
        </MemoryRouter>,
      );

      // The link should have the active class since the route matches
      const link = screen.getByText("Dashboard").closest("a");
      expect(link).toHaveClass("text-primary");
      expect(link).toHaveClass("font-medium");
    });
  });
});
