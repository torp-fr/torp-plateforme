import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { geocodingService, GeocodingResult } from '@/services/api/geocoding.service';
import { useDebounce } from '@/hooks/useDebounce';
import { MapPin, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (result: GeocodingResult) => void;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  label,
  placeholder = "Saisissez une adresse...",
  value: controlledValue,
  onChange,
  onSelect,
  required,
  error,
  className,
  disabled,
}: Props) {
  const [inputValue, setInputValue] = useState(controlledValue || '');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<GeocodingResult | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedValue = useDebounce(inputValue, 300);

  // Recherche suggestions
  useEffect(() => {
    if (debouncedValue.length < 3) {
      setSuggestions([]);
      return;
    }

    // Ne pas rechercher si on a sélectionné cette valeur
    if (selectedResult?.label === debouncedValue) {
      return;
    }

    setIsLoading(true);
    geocodingService.geocode(debouncedValue, { limit: 5, autocomplete: true })
      .then(result => {
        if (result.success && result.data) {
          setSuggestions(result.data);
          setIsOpen(result.data.length > 0);
          setHighlightedIndex(-1);
        }
      })
      .finally(() => setIsLoading(false));
  }, [debouncedValue, selectedResult]);

  // Fermer suggestions au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync avec valeur contrôlée
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInputValue(controlledValue);
    }
  }, [controlledValue]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setSelectedResult(null);
    onChange?.(value);
  }

  function handleSelectSuggestion(result: GeocodingResult) {
    setInputValue(result.label);
    setSelectedResult(result);
    setSuggestions([]);
    setIsOpen(false);
    onChange?.(result.label);
    onSelect?.(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {label && (
        <Label className="mb-1.5 block">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pl-10 pr-10",
            error && "border-red-500",
            selectedResult && "border-green-500"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!isLoading && selectedResult && <Check className="h-4 w-4 text-green-500" />}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {/* Liste suggestions */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((result, index) => (
            <button
              key={`${result.label}-${index}`}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-muted flex items-start gap-2 text-sm transition-colors",
                highlightedIndex === index && "bg-muted"
              )}
              onClick={() => handleSelectSuggestion(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="font-medium">{result.label}</p>
                <p className="text-xs text-muted-foreground">{result.context}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
