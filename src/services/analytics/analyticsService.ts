/**
 * Analytics Service
 * Tracking des métriques et événements utilisateurs
 */

import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export type EventType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'devis_upload_started'
  | 'devis_upload_success'
  | 'devis_upload_error'
  | 'devis_analyzed'
  | 'score_viewed'
  | 'recommendation_viewed'
  | 'qr_code_generated'
  | 'pdf_downloaded'
  | 'feedback_submitted'
  | 'page_view';

export type EventCategory =
  | 'auth'
  | 'devis'
  | 'payment'
  | 'feedback'
  | 'navigation';

export type UserType = 'B2C' | 'B2B';

export interface AnalyticsEvent {
  event_type: EventType;
  event_category: EventCategory;
  user_type?: UserType;
  metadata?: Record<string, any>;
}

export interface DevisAnalysisMetrics {
  user_type: UserType;
  devis_id?: string;
  torp_score_overall: number;
  torp_score_transparency: number;
  torp_score_offer: number;
  torp_score_robustness: number;
  torp_score_price: number;
  grade: string;
  analysis_duration_ms: number;
  file_size_bytes: number;
  file_type: string;
  upload_success: boolean;
  upload_error?: string;
}

export interface AnalyticsOverview {
  total_signups: number;
  total_analyses: number;
  b2c_signups: number;
  b2b_signups: number;
  b2c_analyses: number;
  b2b_analyses: number;
  first_event: string;
  last_event: string;
}

export interface TorpScoreAverages {
  user_type: UserType;
  total_analyses: number;
  avg_overall_score: number;
  avg_transparency: number;
  avg_offer: number;
  avg_robustness: number;
  avg_price: number;
  avg_duration_ms: number;
}

// =====================================================
// SERVICE
// =====================================================

export const analyticsService = {
  /**
   * Track un événement utilisateur
   */
  async trackEvent(event: AnalyticsEvent): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('analytics_events').insert({
        user_id: user?.id,
        session_id: crypto.randomUUID(),
        event_type: event.event_type,
        event_category: event.event_category,
        user_type: event.user_type,
        metadata: event.metadata || {},
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });

      if (error) {
        console.error('Error tracking event:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error tracking event:', error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Track une analyse de devis
   */
  async trackDevisAnalysis(metrics: DevisAnalysisMetrics): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('devis_analysis_metrics').insert({
        user_id: user?.id,
        ...metrics,
      });

      if (error) {
        console.error('Error tracking devis analysis:', error);
        return { success: false, error: error.message };
      }

      // Track également comme événement
      await this.trackEvent({
        event_type: 'devis_analyzed',
        event_category: 'devis',
        user_type: metrics.user_type,
        metadata: {
          score: metrics.torp_score_overall,
          grade: metrics.grade,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error tracking devis analysis:', error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Récupérer les statistiques globales
   */
  async getOverview(): Promise<AnalyticsOverview | null> {
    try {
      const { data, error } = await supabase
        .from('analytics_overview')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching analytics overview:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      return null;
    }
  },

  /**
   * Récupérer les moyennes des scores TORP
   */
  async getScoreAverages(): Promise<TorpScoreAverages[]> {
    try {
      const { data, error } = await supabase
        .from('torp_score_averages')
        .select('*');

      if (error) {
        console.error('Error fetching score averages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching score averages:', error);
      return [];
    }
  },

  /**
   * Récupérer les statistiques d'un utilisateur
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Error fetching user stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }
  },

  /**
   * Récupérer tous les utilisateurs inscrits (admin)
   * Utilise une fonction RPC pour contourner les RLS policies
   * Avec fallback vers requête directe si RPC non disponible
   */
  async getAllUsers(): Promise<any[]> {
    try {
      // Essayer d'abord la fonction RPC (nécessite migration 004)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_users');

      if (!rpcError && rpcData) {
        console.log('✓ Users loaded via RPC:', rpcData.length);
        return rpcData || [];
      }

      // Si RPC échoue (fonction n'existe pas), essayer requête directe
      console.warn('⚠️ RPC get_all_users failed, trying direct query. Error:', rpcError?.message);
      console.log('💡 Appliquez la migration 004_admin_access_policies.sql pour résoudre ce problème');

      const { data: directData, error: directError } = await supabase
        .from('users')
        .select('id, email, name, user_type, company, phone, created_at, subscription_plan, subscription_status')
        .order('created_at', { ascending: false });

      if (directError) {
        console.error('❌ Direct query also failed:', directError);
        return [];
      }

      console.log('✓ Users loaded via direct query:', directData?.length || 0);
      return directData || [];
    } catch (error) {
      console.error('❌ Error fetching all users:', error);
      return [];
    }
  },

  /**
   * Récupérer toutes les analyses de devis (admin)
   * Utilise une fonction RPC pour contourner les RLS policies
   * Avec fallback vers requête directe si RPC non disponible
   */
  async getAllAnalyses(): Promise<any[]> {
    try {
      // Essayer d'abord la fonction RPC (nécessite migration 004)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_analyses');

      if (!rpcError && rpcData) {
        console.log('✓ Analyses loaded via RPC:', rpcData.length);
        return rpcData || [];
      }

      // Si RPC échoue (fonction n'existe pas), essayer requête directe
      console.warn('⚠️ RPC get_all_analyses failed, trying direct query. Error:', rpcError?.message);
      console.log('💡 Appliquez la migration 004_admin_access_policies.sql pour résoudre ce problème');

      const { data: directData, error: directError } = await supabase
        .from('devis_analysis_metrics')
        .select(`
          id,
          user_id,
          user_type,
          devis_id,
          torp_score_overall,
          torp_score_transparency,
          torp_score_offer,
          torp_score_robustness,
          torp_score_price,
          grade,
          analysis_duration_ms,
          file_size_bytes,
          file_type,
          upload_success,
          upload_error,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (directError) {
        console.error('❌ Direct query also failed:', directError);
        return [];
      }

      // Enrichir avec les emails utilisateurs
      const dataWithEmails = await Promise.all(
        (directData || []).map(async (analysis) => {
          if (!analysis.user_id) return { ...analysis, user_email: null };

          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', analysis.user_id)
            .single();

          return {
            ...analysis,
            user_email: userData?.email || null
          };
        })
      );

      console.log('✓ Analyses loaded via direct query:', dataWithEmails.length);
      return dataWithEmails;
    } catch (error) {
      console.error('❌ Error fetching all analyses:', error);
      return [];
    }
  },

  /**
   * Helpers pour tracking rapide
   */
  trackSignup: (userType: UserType) =>
    analyticsService.trackEvent({
      event_type: 'signup',
      event_category: 'auth',
      user_type: userType,
    }),

  trackLogin: (userType: UserType) =>
    analyticsService.trackEvent({
      event_type: 'login',
      event_category: 'auth',
      user_type: userType,
    }),

  trackDevisUploadStarted: (userType: UserType, fileSize: number, fileType: string) =>
    analyticsService.trackEvent({
      event_type: 'devis_upload_started',
      event_category: 'devis',
      user_type: userType,
      metadata: { file_size: fileSize, file_type: fileType },
    }),

  trackDevisUploadSuccess: (userType: UserType) =>
    analyticsService.trackEvent({
      event_type: 'devis_upload_success',
      event_category: 'devis',
      user_type: userType,
    }),

  trackDevisUploadError: (userType: UserType, error: string) =>
    analyticsService.trackEvent({
      event_type: 'devis_upload_error',
      event_category: 'devis',
      user_type: userType,
      metadata: { error },
    }),

  trackPageView: (page: string, userType?: UserType) =>
    analyticsService.trackEvent({
      event_type: 'page_view',
      event_category: 'navigation',
      user_type: userType,
      metadata: { page },
    }),
};

export default analyticsService;
