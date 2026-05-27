import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useAddressAutocomplete, type AddressSuggestion } from "@/hooks/useAddressAutocomplete";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "123 Rue Exemple",
  disabled = false,
  className = "",
}: AddressAutocompleteProps) {
  const { suggestions, isLoading, search, clear } = useAddressAutocomplete();
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionJustMadeRef = useRef(false);

  useEffect(() => {
    // If a suggestion was just selected, skip re-opening the dropdown
    // to prevent the value change (from onChange) from re-triggering search
    if (selectionJustMadeRef.current) {
      selectionJustMadeRef.current = false;
      return;
    }

    if (value.trim().length >= 2) {
      search(value);
      setOpen(true);
    } else {
      clear();
      setOpen(false);
    }
  }, [value, search, clear]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [suggestions]);

  const handleSelect = (addr: AddressSuggestion) => {
    selectionJustMadeRef.current = true;
    onChange(addr.adresse_complete);
    onSelect?.(addr);
    setOpen(false);
    clear();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
          handleSelect(suggestions[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        clear();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.parentElement?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const listItemClass = (isHighlighted: boolean) =>
    "flex items-start gap-2 px-3 py-2 text-sm cursor-pointer " +
    (isHighlighted ? "bg-accent text-accent-foreground" : "text-popover-foreground");

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 || isLoading) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {suggestions.map((addr, index) => (
            <li
              key={index}
              onClick={() => handleSelect(addr)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={listItemClass(index === highlightIndex)}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <span className="block truncate">{addr.adresse_complete}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {addr.ville} · {addr.code_postal} · {addr.distance_km.toFixed(1)} km
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
