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
