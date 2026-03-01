/**
 * Stripe Configuration
 * Configuration pour l'intégration du paiement Stripe
 *
 * IMPORTANT: Stripe est désactivé par défaut pendant la phase de test gratuite.
 * Pour activer Stripe:
 * 1. Définir VITE_STRIPE_ENABLED=true dans .env
 * 2. Ajouter VITE_STRIPE_PUBLIC_KEY avec votre clé publique Stripe
 */

import { env } from './env';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface StripeConfig {
  /** Si Stripe est activé */
  enabled: boolean;
  /** Clé publique Stripe */
  publicKey: string | null;
  /** Mode test ou production */
  testMode: boolean;
  /** URL de webhook (pour le backend) */
  webhookEndpoint: string;
}

export interface StripePriceConfig {
  /** ID du produit/prix Stripe */
  priceId: string;
  /** Nom du plan */
  name: string;
  /** Prix en centimes */
  amount: number;
  /** Devise */
  currency: string;
  /** Description */
  description: string;
  /** Fonctionnalités incluses */
  features: string[];
  /** Type de plan */
  type: 'one_time' | 'recurring';
  /** Intervalle de récurrence */
  interval?: 'month' | 'year';
}

/**
 * Configuration Stripe principale
 */
export const stripeConfig: StripeConfig = {
  // Désactivé par défaut - activer via VITE_STRIPE_ENABLED=true
  enabled: import.meta.env.VITE_STRIPE_ENABLED === 'true',
  publicKey: env.services.stripe?.publicKey || null,
  testMode: env.app.env !== 'production',
  webhookEndpoint: '/api/webhooks/stripe',
};

/**
 * Prix B2C - Analyses à l'unité
 */
export const b2cPrices: StripePriceConfig[] = [
  {
    priceId: 'price_b2c_flash', // À remplacer par l'ID réel Stripe
    name: 'Analyse Flash',
    amount: 990, // 9.90€ en centimes
    currency: 'eur',
    description: 'Score TORP instantané en 30 secondes',
    features: [
      'Score TORP sur 1000 points',
      'Détection anomalies prix',
      'Comparatif marché local',
      'Rapport PDF 2 pages',
    ],
    type: 'one_time',
  },
  {
    priceId: 'price_b2c_complete', // À remplacer par l'ID réel Stripe
    name: 'Analyse Complète',
    amount: 1990, // 19.90€
    currency: 'eur',
    description: 'Analyse approfondie + Suivi paiements',
    features: [
      'Tout Analyse Flash',
      'Vérification DTU/normes',
      'Scoring entreprise complet',
      'Suivi paiements intégré',
      'Rapport PDF 4-5 pages',
    ],
    type: 'one_time',
  },
  {
    priceId: 'price_b2c_multi', // À remplacer par l'ID réel Stripe
    name: 'Multi-Devis',
    amount: 2990, // 29.90€
    currency: 'eur',
    description: 'Comparer jusqu\'à 5 devis',
    features: [
      'Tout Analyse Complète',
      'Comparatif détaillé jusqu\'à 5 devis',
      'Recommandation du meilleur rapport qualité/prix',
      'Tableau comparatif PDF',
    ],
    type: 'one_time',
  },
  {
    priceId: 'price_b2c_premium', // À remplacer par l'ID réel Stripe
    name: 'Analyse + CCTP',
    amount: 4490, // 44.90€
    currency: 'eur',
    description: 'Protection maximale avec CCTP',
    features: [
      'Tout Multi-Devis',
      'Génération CCTP personnalisé',
      'Check-list points de vigilance',
      'Protection juridique renforcée',
    ],
    type: 'one_time',
  },
];

/**
 * Prix B2B - Abonnements professionnels
 */
export const b2bPrices: StripePriceConfig[] = [
  {
    priceId: 'price_b2b_starter', // À remplacer par l'ID réel Stripe
    name: 'Starter',
    amount: 4900, // 49€/mois
    currency: 'eur',
    description: 'Idéal pour démarrer',
    features: [
      '10 analyses/mois',
      'QR Code TORP',
      'Page vitrine',
      'Support email',
    ],
    type: 'recurring',
    interval: 'month',
  },
  {
    priceId: 'price_b2b_pro', // À remplacer par l'ID réel Stripe
    name: 'Pro',
    amount: 9900, // 99€/mois
    currency: 'eur',
    description: 'Pour les professionnels actifs',
    features: [
      '50 analyses/mois',
      'QR Code TORP Premium',
      'Badge certifié',
      'Analytics avancés',
      'Support prioritaire',
    ],
    type: 'recurring',
    interval: 'month',
  },
  {
    priceId: 'price_b2b_enterprise', // À remplacer par l'ID réel Stripe
    name: 'Entreprise',
    amount: 19900, // 199€/mois
    currency: 'eur',
    description: 'Solution complète',
    features: [
      'Analyses illimitées',
      'Multi-utilisateurs',
      'API accès',
      'Personnalisation marque',
      'Account Manager dédié',
    ],
    type: 'recurring',
    interval: 'month',
  },
];

/**
 * Vérifier si Stripe est configuré et activé
 */
export const isStripeEnabled = (): boolean => {
  return stripeConfig.enabled && !!stripeConfig.publicKey;
};

/**
 * Obtenir la configuration de prix par ID
 */
export const getPriceById = (priceId: string): StripePriceConfig | undefined => {
  return [...b2cPrices, ...b2bPrices].find(p => p.priceId === priceId);
};

/**
 * Formater un montant en devise
 */
export const formatPrice = (amount: number, currency: string = 'eur'): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

/**
 * Créer une session de checkout Stripe (côté client)
 * Note: En production, cette logique devrait être côté serveur
 */
export const createCheckoutSession = async (priceId: string, userId: string): Promise<string | null> => {
  if (!isStripeEnabled()) {
    warn('[Stripe] Stripe is not enabled. Enable it by setting VITE_STRIPE_ENABLED=true');
    return null;
  }

  // TODO: Implémenter l'appel API vers votre backend
  // Le backend créera la session Stripe et retournera l'URL de checkout
  log('[Stripe] Would create checkout session for:', { priceId, userId });

  return null;
};

export default stripeConfig;
