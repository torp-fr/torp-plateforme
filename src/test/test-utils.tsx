/**
 * Test utilities
 * Custom render function with all providers
 */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/context/AppContext';
import { TooltipProvider } from '@/components/ui/tooltip';

// Create a new QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

interface AllProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper with all app providers for testing
 */
export function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render with all providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  type: 'B2C' as const,
};

/**
 * Mock project data for testing
 */
export const mockProject = {
  id: 'test-project-1',
  name: 'Test Project',
  type: 'Renovation',
  status: 'completed' as const,
  score: 85,
  grade: 'A' as const,
  amount: '15 000€',
  createdAt: '2024-01-01',
  company: 'Test Company',
};

/**
 * Mock devis data for testing
 */
export const mockDevis = {
  id: 'test-devis-1',
  montant: 15000,
  entreprise: {
    siret: '12345678901234',
    nom: 'Test Company SARL',
    age: 10,
    chiffreAffaires: 500000,
    certification: ['RGE', 'Qualibat'],
    assurances: {
      decennale: true,
      rcPro: true,
      validite: '2025-12-31',
    },
    reputation: 85,
    litiges: 0,
  },
  itemsDevis: [],
  completude: 90,
  conformite: 95,
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
