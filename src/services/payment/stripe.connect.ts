/**
 * Stripe Connect Service
 * Gestion de l'onboarding et des comptes connectés pour les entreprises
 */

import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const APP_URL = import.meta.env.VITE_APP_URL || 'https://torp.fr';

// =====================================================
// TYPES
// =====================================================

export interface ConnectAccountStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  dashboardUrl?: string;
}

export interface OnboardingResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  error?: string;
}

// =====================================================
// SERVICE
// =====================================================

export class StripeConnectService {
  /**
   * Vérifie si Stripe est configuré
   */
  static isConfigured(): boolean {
    return !!import.meta.env.VITE_STRIPE_SECRET_KEY;
  }

  /**
   * Crée un compte Stripe Connect pour une entreprise
   */
  static async createConnectAccount(
    userId: string,
    businessProfile: {
      businessType: 'individual' | 'company';
      companyName?: string;
      firstName?: string;
      lastName?: string;
      email: string;
      phone?: string;
      siret?: string;
      address?: {
        line1: string;
        city: string;
        postalCode: string;
        country?: string;
      };
    }
  ): Promise<OnboardingResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Stripe non configuré' };
    }

    try {
      // Vérifier si un compte existe déjà
      const { data: existingAccount } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (existingAccount?.stripe_account_id) {
        // Compte existe, retourner l'URL d'onboarding
        return this.createOnboardingLink(userId, existingAccount.stripe_account_id);
      }

      // Créer le compte Stripe Connect
      const accountParams: Stripe.AccountCreateParams = {
        type: 'express', // Express pour une expérience simplifiée
        country: 'FR',
        email: businessProfile.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: businessProfile.businessType,
        metadata: {
          user_id: userId,
          siret: businessProfile.siret || '',
        },
      };

      // Ajouter les infos entreprise si disponibles
      if (businessProfile.businessType === 'company' && businessProfile.companyName) {
        accountParams.company = {
          name: businessProfile.companyName,
          tax_id: businessProfile.siret,
          phone: businessProfile.phone,
          address: businessProfile.address ? {
            line1: businessProfile.address.line1,
            city: businessProfile.address.city,
            postal_code: businessProfile.address.postalCode,
            country: businessProfile.address.country || 'FR',
          } : undefined,
        };
      } else if (businessProfile.businessType === 'individual') {
        accountParams.individual = {
          first_name: businessProfile.firstName,
          last_name: businessProfile.lastName,
          email: businessProfile.email,
          phone: businessProfile.phone,
        };
      }

      const account = await stripe.accounts.create(accountParams);

      // Sauvegarder en base
      await supabase.from('enterprise_payment_accounts').upsert({
        user_id: userId,
        stripe_account_id: account.id,
        stripe_account_type: 'express',
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_details_submitted: account.details_submitted,
        stripe_capabilities: account.capabilities,
        business_type: businessProfile.businessType,
        company_name: businessProfile.companyName,
        siret: businessProfile.siret,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

      // Créer le lien d'onboarding
      return this.createOnboardingLink(userId, account.id);

    } catch (error) {
      console.error('[StripeConnect] Erreur création compte:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la création du compte',
      };
    }
  }

  /**
   * Crée un lien d'onboarding pour compléter la configuration
   */
  static async createOnboardingLink(
    userId: string,
    accountId?: string
  ): Promise<OnboardingResult> {
    try {
      // Récupérer l'accountId si non fourni
      if (!accountId) {
        const { data: account } = await supabase
          .from('enterprise_payment_accounts')
          .select('stripe_account_id')
          .eq('user_id', userId)
          .single();

        accountId = account?.stripe_account_id;
      }

      if (!accountId) {
        return { success: false, error: 'Compte Stripe non trouvé' };
      }

      // Créer le lien d'onboarding
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${APP_URL}/pro/settings/payments?refresh=true`,
        return_url: `${APP_URL}/pro/settings/payments?success=true`,
        type: 'account_onboarding',
        collect: 'eventually_due',
      });

      return {
        success: true,
        accountId,
        onboardingUrl: accountLink.url,
      };

    } catch (error) {
      console.error('[StripeConnect] Erreur lien onboarding:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la création du lien',
      };
    }
  }

  /**
   * Récupère le statut du compte Connect d'une entreprise
   */
  static async getAccountStatus(userId: string): Promise<ConnectAccountStatus | null> {
    try {
      const { data: localAccount } = await supabase
        .from('enterprise_payment_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!localAccount?.stripe_account_id) {
        return null;
      }

      // Récupérer les infos à jour depuis Stripe
      const stripeAccount = await stripe.accounts.retrieve(localAccount.stripe_account_id);

      // Mettre à jour en base
      await supabase
        .from('enterprise_payment_accounts')
        .update({
          stripe_charges_enabled: stripeAccount.charges_enabled,
          stripe_payouts_enabled: stripeAccount.payouts_enabled,
          stripe_details_submitted: stripeAccount.details_submitted,
          stripe_capabilities: stripeAccount.capabilities,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // Déterminer si des actions sont requises
      const requiresAction =
        !stripeAccount.details_submitted ||
        (stripeAccount.requirements?.currently_due?.length || 0) > 0 ||
        (stripeAccount.requirements?.past_due?.length || 0) > 0;

      return {
        accountId: localAccount.stripe_account_id,
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        detailsSubmitted: stripeAccount.details_submitted,
        requiresAction,
        requirements: stripeAccount.requirements ? {
          currentlyDue: stripeAccount.requirements.currently_due || [],
          eventuallyDue: stripeAccount.requirements.eventually_due || [],
          pastDue: stripeAccount.requirements.past_due || [],
          pendingVerification: stripeAccount.requirements.pending_verification || [],
        } : undefined,
      };

    } catch (error) {
      console.error('[StripeConnect] Erreur récupération statut:', error);
      return null;
    }
  }

  /**
   * Crée un lien vers le dashboard Express
   */
  static async createDashboardLink(userId: string): Promise<string | null> {
    try {
      const { data: account } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account?.stripe_account_id) {
        return null;
      }

      const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);
      return loginLink.url;

    } catch (error) {
      console.error('[StripeConnect] Erreur lien dashboard:', error);
      return null;
    }
  }

  /**
   * Récupère le solde du compte Connect
   */
  static async getAccountBalance(userId: string): Promise<{
    available: number;
    pending: number;
    currency: string;
  } | null> {
    try {
      const { data: account } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account?.stripe_account_id) {
        return null;
      }

      const balance = await stripe.balance.retrieve({
        stripeAccount: account.stripe_account_id,
      });

      const eurAvailable = balance.available.find(b => b.currency === 'eur');
      const eurPending = balance.pending.find(b => b.currency === 'eur');

      return {
        available: (eurAvailable?.amount || 0) / 100,
        pending: (eurPending?.amount || 0) / 100,
        currency: 'EUR',
      };

    } catch (error) {
      console.error('[StripeConnect] Erreur récupération solde:', error);
      return null;
    }
  }

  /**
   * Récupère l'historique des payouts
   */
  static async getPayoutHistory(
    userId: string,
    limit: number = 10
  ): Promise<{
    id: string;
    amount: number;
    arrivalDate: Date;
    status: string;
    method: string;
  }[]> {
    try {
      const { data: account } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account?.stripe_account_id) {
        return [];
      }

      const payouts = await stripe.payouts.list({
        limit,
      }, {
        stripeAccount: account.stripe_account_id,
      });

      return payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount / 100,
        arrivalDate: new Date(payout.arrival_date * 1000),
        status: payout.status,
        method: payout.method,
      }));

    } catch (error) {
      console.error('[StripeConnect] Erreur historique payouts:', error);
      return [];
    }
  }

  /**
   * Supprime le compte Connect (déconnexion)
   */
  static async disconnectAccount(userId: string): Promise<boolean> {
    try {
      const { data: account } = await supabase
        .from('enterprise_payment_accounts')
        .select('stripe_account_id')
        .eq('user_id', userId)
        .single();

      if (!account?.stripe_account_id) {
        return false;
      }

      // On ne supprime pas le compte Stripe, on le déconnecte juste de notre plateforme
      await supabase
        .from('enterprise_payment_accounts')
        .update({
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          deauthorized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return true;

    } catch (error) {
      console.error('[StripeConnect] Erreur déconnexion:', error);
      return false;
    }
  }

  /**
   * Vérifie les exigences KYC manquantes
   */
  static async getKYCRequirements(userId: string): Promise<{
    required: string[];
    labels: Record<string, string>;
  } | null> {
    const status = await this.getAccountStatus(userId);

    if (!status?.requirements) {
      return null;
    }

    // Mapping des requirements Stripe vers des labels français
    const labels: Record<string, string> = {
      'individual.first_name': 'Prénom',
      'individual.last_name': 'Nom',
      'individual.dob.day': 'Date de naissance (jour)',
      'individual.dob.month': 'Date de naissance (mois)',
      'individual.dob.year': 'Date de naissance (année)',
      'individual.address.line1': 'Adresse',
      'individual.address.city': 'Ville',
      'individual.address.postal_code': 'Code postal',
      'individual.verification.document': 'Pièce d\'identité',
      'company.name': 'Nom de l\'entreprise',
      'company.tax_id': 'Numéro SIRET',
      'company.address.line1': 'Adresse de l\'entreprise',
      'company.address.city': 'Ville de l\'entreprise',
      'company.address.postal_code': 'Code postal entreprise',
      'company.verification.document': 'Extrait Kbis',
      'external_account': 'Coordonnées bancaires (IBAN)',
      'tos_acceptance.date': 'Acceptation des CGU',
      'tos_acceptance.ip': 'Acceptation des CGU',
    };

    const allRequired = [
      ...status.requirements.currentlyDue,
      ...status.requirements.pastDue,
    ];

    return {
      required: allRequired,
      labels,
    };
  }
}

export default StripeConnectService;
