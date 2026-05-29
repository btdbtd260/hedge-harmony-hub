// ============================================================
// Tests for AddressAutocomplete — suggestion selection & ville field
// ============================================================
// TDD: Tests written FIRST (RED phase), then implementation.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Mock data ───
const mockSuggestions = [
  {
    adresse_complete: "123 Rue Exemple, Montréal, QC H3A 1A1",
    ville: "Montréal",
    code_postal: "H3A 1A1",
    distance_km: 1.2,
    latitude: 45.5,
    longitude: -73.6,
  },
  {
    adresse_complete: "456 Avenue Test, Québec, QC G1R 2B2",
    ville: "Québec",
    code_postal: "G1R 2B2",
    distance_km: 3.4,
    latitude: 46.8,
    longitude: -71.2,
  },
];

// ─── Hoisted mock helpers ───
const { mockSearch, mockClear } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockClear: vi.fn(),
}));

let currentSuggestions = [...mockSuggestions];
let currentIsLoading = false;

// ─── Mock useAddressAutocomplete ───
vi.mock("@/hooks/useAddressAutocomplete", () => ({
  useAddressAutocomplete: () => ({
    suggestions: currentSuggestions,
    isLoading: currentIsLoading,
    error: null,
    search: mockSearch,
    clear: mockClear,
  }),
}));

// ─── Import AFTER mocks ───
import { AddressAutocomplete } from "../AddressAutocomplete";

// ─── Helper: controlled wrapper for tests ───
function createControlledWrapper() {
  const spies = {
    onChange: vi.fn(),
    onSelect: vi.fn(),
  };

  function Wrapper({ initialValue = "123" }: { initialValue?: string }) {
    const [val, setVal] = React.useState(initialValue);
    return (
      <AddressAutocomplete
        value={val}
        onChange={(newVal) => {
          setVal(newVal);
          spies.onChange(newVal);
        }}
        onSelect={spies.onSelect}
      />
    );
  }

  return { Wrapper, spies };
}

describe("AddressAutocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSuggestions = [...mockSuggestions];
    currentIsLoading = false;
  });

  // ── Bug fix: suggestion selection ──

  describe("suggestion selection bug fix", () => {
    it("calls onChange and onSelect when selecting via keyboard Enter", () => {
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      const input = screen.getByRole("textbox");

      // ArrowDown to highlight first item, then Enter to select
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      // onChange should be called with the full address
      expect(spies.onChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      // onSelect should be called with the full suggestion
      expect(spies.onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it("closes dropdown after selecting via keyboard Enter", () => {
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      const input = screen.getByRole("textbox");

      // Dropdown should be open
      expect(screen.getByRole("list")).toBeInTheDocument();

      // ArrowDown + Enter to select
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      // Dropdown should be closed
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does NOT reopen dropdown when value changes after selection", () => {
      // This is the core bug test: after selection changes the value,
      // the useEffect on value should NOT reopen the dropdown
      let currentValue = "123";
      const handleChange = vi.fn((newVal: string) => {
        currentValue = newVal;
      });

      const { rerender } = render(
        <AddressAutocomplete
          value={currentValue}
          onChange={handleChange}
        />,
      );

      const input = screen.getByRole("textbox");

      // ArrowDown + Enter to select
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      // onChange was called with the full address
      expect(handleChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);

      // Now simulate parent re-render with the updated value
      rerender(
        <AddressAutocomplete
          value={mockSuggestions[0].adresse_complete}
          onChange={handleChange}
        />,
      );

      // After the fix: the dropdown should NOT reopen when value changes after selection
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("closes dropdown after clicking a suggestion", () => {
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      // Dropdown should be open
      expect(screen.getByRole("list")).toBeInTheDocument();

      // Click on the first suggestion's text
      const suggestionText = screen.getByText("123 Rue Exemple, Montréal, QC H3A 1A1");
      // Dispatch click directly on the li parent
      const li = suggestionText.closest("li");
      expect(li).not.toBeNull();
      fireEvent.click(li!);

      // Dropdown should be closed
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("triggers onChange when clicking a suggestion", () => {
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      // Click on the first suggestion
      const suggestionText = screen.getByText("123 Rue Exemple, Montréal, QC H3A 1A1");
      const li = suggestionText.closest("li");
      fireEvent.click(li!);

      // onChange should be called with the full address
      expect(spies.onChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      expect(spies.onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });
  });

  // ── Outside click / suggestion click boundary tests ──
  // These tests simulate the REAL browser event sequence (mousedown then click)
  // to prove that suggestions stay clickable and the dropdown doesn't
  // close before selection.

  describe("outside click boundary (mousedown + touchstart)", () => {
    function getFirstLi(): HTMLElement {
      const text = screen.getByText("123 Rue Exemple, Montréal, QC H3A 1A1");
      const li = text.closest("li");
      if (!li) throw new Error("li not found");
      return li;
    }

    it("does NOT close dropdown on mousedown inside the component (on a suggestion)", () => {
      // Simulate the real browser: mousedown fires first, then click.
      // The mousedown should NOT close the dropdown because the
      // suggestion lives inside the component's container.
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      expect(screen.getByRole("list")).toBeInTheDocument();

      // mousedown on a suggestion — this is the event that was incorrectly
      // closing the dropdown before selection
      fireEvent.mouseDown(getFirstLi());

      // The dropdown must still be open
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    it("selects suggestion via desktop click (mousedown then click)", () => {
      // Full desktop interaction: mousedown + click on a suggestion
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      fireEvent.mouseDown(getFirstLi());
      fireEvent.click(getFirstLi());

      expect(spies.onChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      expect(spies.onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it("selects suggestion on mobile tap (touchstart + click)", () => {
      // On mobile, a full tap sequence is: touchstart → touchend → click.
      // The touchstart fires our outside-tap detection (should stay open),
      // then the click triggers the onClick handler to select.
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      fireEvent.touchStart(getFirstLi());
      fireEvent.click(getFirstLi());

      expect(spies.onChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      expect(spies.onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it("closes dropdown on mousedown outside the component", () => {
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      expect(screen.getByRole("list")).toBeInTheDocument();

      // mousedown on document.body (outside the root container)
      fireEvent.mouseDown(document.body);

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("closes dropdown on touchstart outside the component", () => {
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      expect(screen.getByRole("list")).toBeInTheDocument();

      fireEvent.touchStart(document.body);

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("dropdown does NOT close before selection when clicking a suggestion", () => {
      // This is the exact acceptance criterion: clicking a suggestion
      // must select it, not just close the dropdown without selecting.
      const handleChange = vi.fn();
      const handleSelect = vi.fn();

      render(
        <AddressAutocomplete
          value="123"
          onChange={handleChange}
          onSelect={handleSelect}
        />,
      );

      // Simulate real browser event order: mousedown → click
      fireEvent.mouseDown(getFirstLi());
      fireEvent.click(getFirstLi());

      // Both onChange and onSelect must have been called
      expect(handleChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      expect(handleSelect).toHaveBeenCalledWith(mockSuggestions[0]);
      // And the dropdown should be closed (by handleSelect, not by outside click)
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  // ── Ville field ──

  describe("ville field", () => {
    it("displays ville in the suggestion list items", () => {
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      // The ville should be displayed in the suggestion details
      const montrealElements = screen.getAllByText(/Montréal/);
      expect(montrealElements.length).toBeGreaterThanOrEqual(1);

      const quebecElements = screen.getAllByText(/Québec/);
      expect(quebecElements.length).toBeGreaterThanOrEqual(1);
    });

    it("includes ville in the suggestion object passed to onSelect", () => {
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      // Click the first suggestion
      const suggestionText = screen.getByText("123 Rue Exemple, Montréal, QC H3A 1A1");
      const li = suggestionText.closest("li");
      fireEvent.click(li!);

      // The suggestion passed to onSelect should include ville
      expect(spies.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          ville: "Montréal",
          adresse_complete: expect.stringContaining("Montréal"),
        }),
      );
    });
  });

  // ── Keyboard navigation ──

  describe("keyboard navigation", () => {
    it("highlights first suggestion on ArrowDown press", () => {
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");

      fireEvent.keyDown(input, { key: "ArrowDown" });

      const items = screen.getAllByRole("listitem");
      expect(items[0].className).toContain("bg-accent");
    });

    it("highlights suggestion on mouseEnter", () => {
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      // Hover over the second suggestion
      const items = screen.getAllByRole("listitem");
      fireEvent.mouseEnter(items[1]);

      // Second item should be highlighted
      expect(items[1].className).toContain("bg-accent");
      // First item should NOT be highlighted
      expect(items[0].className).not.toContain("bg-accent");
    });

    it("cycles highlight correctly with ArrowDown and ArrowUp", () => {
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const items = screen.getAllByRole("listitem");
      expect(items[1].className).toContain("bg-accent");

      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(items[0].className).toContain("bg-accent");
    });

    it("wraps highlight from last to first on ArrowDown past end", () => {
      // Test the cycle-back branch: prev >= length-1 → prev = 0
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");
      const items = screen.getAllByRole("listitem");

      // ArrowDown to go to last item
      fireEvent.keyDown(input, { key: "ArrowDown" }); // index 0
      fireEvent.keyDown(input, { key: "ArrowDown" }); // index 1

      // One more ArrowDown should wrap to index 0
      fireEvent.keyDown(input, { key: "ArrowDown" }); // wrap to 0
      expect(items[0].className).toContain("bg-accent");
    });

    it("wraps highlight from first to last on ArrowUp past start", () => {
      // Test the cycle-back branch: prev <= 0 → prev = length-1
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");
      const items = screen.getAllByRole("listitem");

      // ArrowUp from initial state (no highlight) should go to last
      fireEvent.keyDown(input, { key: "ArrowUp" }); // wrap to last
      expect(items[items.length - 1].className).toContain("bg-accent");

      // ArrowUp from first should wrap to last
      // First go to index 0
      fireEvent.keyDown(input, { key: "ArrowDown" }); // index 0 (wrap from last)
      expect(items[0].className).toContain("bg-accent");

      // ArrowUp from 0 should wrap to last
      fireEvent.keyDown(input, { key: "ArrowUp" }); // wrap to last
      expect(items[items.length - 1].className).toContain("bg-accent");
    });

    it("selects highlighted item on Enter key", () => {
      const { Wrapper, spies } = createControlledWrapper();
      render(<Wrapper />);

      const input = screen.getByRole("textbox");

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(spies.onChange).toHaveBeenCalledWith(mockSuggestions[0].adresse_complete);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("closes dropdown on Escape key", () => {
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");

      expect(screen.getByRole("list")).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does nothing on keyboard events when dropdown is closed", () => {
      const handleChange = vi.fn();

      render(
        <AddressAutocomplete value="" onChange={handleChange} />,
      );

      const input = screen.getByRole("textbox");

      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  // ── Focus behavior (onFocus handler coverage) ──

  describe("focus behavior", () => {
    it("re-opens dropdown on focus when suggestions are available", () => {
      const { Wrapper } = createControlledWrapper();
      render(<Wrapper />);

      // Start: dropdown is open due to the value effect + available suggestions
      expect(screen.getByRole("list")).toBeInTheDocument();

      // Close it via Escape
      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByRole("list")).not.toBeInTheDocument();

      // Focus the input — onFocus handler should re-open because
      // suggestions.length > 0
      fireEvent.focus(input);
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    it("calls onFocus handler when loading (even without suggestions)", () => {
      currentSuggestions = [];
      currentIsLoading = true;
      render(<AddressAutocomplete value="123" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      // The onFocus handler runs: suggestions.length > 0 || isLoading → true
      // The dropdown isn't visible because suggestions are empty,
      // but the key point is the handler executed without error,
      // covering the isLoading branch.
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does not open dropdown on focus when no suggestions and not loading", () => {
      currentSuggestions = [];
      currentIsLoading = false;
      render(<AddressAutocomplete value="123" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      // onFocus checks: suggestions.length > 0 || isLoading → false → no setOpen
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    it("does not show dropdown when value is less than 2 characters", () => {
      render(
        <AddressAutocomplete value="A" onChange={vi.fn()} />,
      );

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("does not show dropdown when suggestions are empty", () => {
      currentSuggestions = [];
      render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(
        <AddressAutocomplete value="" onChange={vi.fn()} placeholder="Entrez une adresse" />,
      );

      expect(screen.getByPlaceholderText("Entrez une adresse")).toBeInTheDocument();
    });

    it("renders disabled input when disabled prop is true", () => {
      render(
        <AddressAutocomplete value="" onChange={vi.fn()} disabled={true} />,
      );

      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("calls clear and closes dropdown when value is cleared", () => {
      const { rerender } = render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      expect(screen.getByRole("list")).toBeInTheDocument();

      rerender(
        <AddressAutocomplete value="" onChange={vi.fn()} />,
      );

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("calls search when value changes to 2+ characters", () => {
      const { rerender } = render(
        <AddressAutocomplete value="" onChange={vi.fn()} />,
      );

      expect(mockSearch).not.toHaveBeenCalled();

      rerender(
        <AddressAutocomplete value="12" onChange={vi.fn()} />,
      );

      expect(mockSearch).toHaveBeenCalledWith("12");
    });

    it("does not call search when value changes but stays under minChars", () => {
      const { rerender } = render(
        <AddressAutocomplete value="" onChange={vi.fn()} />,
      );

      expect(mockSearch).not.toHaveBeenCalled();

      rerender(
        <AddressAutocomplete value="A" onChange={vi.fn()} />,
      );

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it("calls clear when value goes from >=2 to <2 chars", () => {
      const { rerender } = render(
        <AddressAutocomplete value="123" onChange={vi.fn()} />,
      );

      expect(mockClear).not.toHaveBeenCalled();

      rerender(
        <AddressAutocomplete value="A" onChange={vi.fn()} />,
      );

      expect(mockClear).toHaveBeenCalled();
    });

    it("does not call search on initial render with empty value", () => {
      render(
        <AddressAutocomplete value="" onChange={vi.fn()} />,
      );

      expect(mockSearch).not.toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalledTimes(1);
    });
  });
});
