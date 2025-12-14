/**
 * User Preferences Service
 * Service pour vérifier et appliquer les préférences utilisateur
 * Utilisé par le système de notifications pour respecter les choix des utilisateurs
 */

import { supabase } from '@/lib/supabase';

export interface UserNotificationPreferences {
  email_analyse: boolean;
  email_documents: boolean;
  email_projets: boolean;
  email_marketing: boolean;
  notification_email: boolean;
  notification_sms: boolean;
  notification_push: boolean;
}

export interface UserPreferences extends UserNotificationPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  email_analyse: true,
  email_documents: true,
  email_projets: true,
  email_marketing: false,
  notification_email: true,
  notification_sms: false,
  notification_push: true,
};

class UserPreferencesService {
  private cache: Map<string, { prefs: UserPreferences; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Récupère les préférences d'un utilisateur (avec cache)
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    // Vérifier le cache
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.prefs;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('preferences, notification_email, notification_sms')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[UserPreferencesService] Erreur récupération:', error);
        return DEFAULT_PREFERENCES;
      }

      // Fusionner les préférences stockées avec les défauts
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        ...(data?.preferences || {}),
        notification_email: data?.notification_email ?? DEFAULT_PREFERENCES.notification_email,
        notification_sms: data?.notification_sms ?? DEFAULT_PREFERENCES.notification_sms,
      };

      // Mettre en cache
      this.cache.set(userId, { prefs, timestamp: Date.now() });

      return prefs;
    } catch (err) {
      console.error('[UserPreferencesService] Exception:', err);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Met à jour les préférences
   */
  async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<boolean> {
    try {
      // Récupérer les préférences actuelles
      const current = await this.getPreferences(userId);
      const merged = { ...current, ...updates };

      // Mettre à jour en base
      const { error } = await supabase
        .from('users')
        .update({
          preferences: merged,
          notification_email: merged.notification_email,
          notification_sms: merged.notification_sms,
        })
        .eq('id', userId);

      if (error) {
        console.error('[UserPreferencesService] Erreur mise à jour:', error);
        return false;
      }

      // Invalider le cache
      this.cache.delete(userId);

      return true;
    } catch (err) {
      console.error('[UserPreferencesService] Exception update:', err);
      return false;
    }
  }

  /**
   * Vérifie si l'utilisateur accepte un type de notification par email
   */
  async canSendEmail(userId: string, type: 'analyse' | 'documents' | 'projets' | 'marketing'): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    // Vérifier d'abord si les notifications email sont activées globalement
    if (!prefs.notification_email) {
      return false;
    }

    // Puis vérifier le type spécifique
    switch (type) {
      case 'analyse':
        return prefs.email_analyse;
      case 'documents':
        return prefs.email_documents;
      case 'projets':
        return prefs.email_projets;
      case 'marketing':
        return prefs.email_marketing;
      default:
        return true;
    }
  }

  /**
   * Vérifie si l'utilisateur accepte les SMS
   */
  async canSendSMS(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.notification_sms;
  }

  /**
   * Vérifie si l'utilisateur accepte les notifications push
   */
  async canSendPush(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs.notification_push;
  }

  /**
   * Invalide le cache pour un utilisateur
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Vide tout le cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const userPreferencesService = new UserPreferencesService();
export default userPreferencesService;
