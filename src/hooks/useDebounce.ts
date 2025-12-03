import { useState, useEffect } from 'react';

/**
 * Hook pour débouncer une valeur
 * Utile pour éviter les appels API trop fréquents lors de la saisie
 *
 * @param value La valeur à débouncer
 * @param delay Le délai en millisecondes
 * @returns La valeur débouncée
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
