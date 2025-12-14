/**
 * ProLayout Component
 * Wrapper qui utilise AppLayout pour un sidebar unifié
 * Conservé pour compatibilité avec les pages existantes
 */

import { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

interface ProLayoutProps {
  children: ReactNode;
}

/**
 * ProLayout est maintenant un simple wrapper autour d'AppLayout
 * pour assurer la cohérence du sidebar sur toute la plateforme
 */
export function ProLayout({ children }: ProLayoutProps) {
  return <AppLayout>{children}</AppLayout>;
}

export default ProLayout;
