/**
 * Feedback Service
 * Gestion des retours utilisateurs et suggestions
 */

import { supabase } from '@/lib/supabase';
import { analyticsService } from '../analytics/analyticsService';

// =====================================================
// TYPES
// =====================================================

export type FeedbackType =
  | 'bug'
  | 'feature_request'
  | 'improvement'
  | 'praise'
  | 'other';

export type FeedbackCategory =
  | 'ui'
  | 'performance'
  | 'feature'
  | 'documentation'
  | 'scoring'
  | 'other';

export type FeedbackStatus =
  | 'new'
  | 'reviewed'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type UserType = 'B2C' | 'B2B';

export interface FeedbackSubmission {
  feedback_type: FeedbackType;
  category?: FeedbackCategory;
  satisfaction_score?: number; // 1-5
  title?: string;
  message: string;
  page_url?: string;
  screenshot_url?: string;
  metadata?: Record<string, any>;
}

export interface Feedback extends FeedbackSubmission {
  id: string;
  user_id: string;
  user_email: string;
  user_type: UserType;
  status: FeedbackStatus;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummary {
  status: FeedbackStatus;
  feedback_type: FeedbackType;
  user_type: UserType;
  count: number;
  avg_satisfaction: number;
}

// =====================================================
// SERVICE
// =====================================================

export const feedbackService = {
  /**
   * Soumettre un feedback
   */
  async submitFeedback(
    feedback: FeedbackSubmission,
    userType: UserType
  ): Promise<{ success: boolean; error?: string; feedbackId?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_type: userType,
          feedback_type: feedback.feedback_type,
          category: feedback.category,
          satisfaction_score: feedback.satisfaction_score,
          title: feedback.title,
          message: feedback.message,
          page_url: feedback.page_url || window.location.href,
          screenshot_url: feedback.screenshot_url,
          metadata: feedback.metadata || {},
          status: 'new',
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting feedback:', error);
        return { success: false, error: error.message };
      }

      // Track l'événement
      await analyticsService.trackEvent({
        event_type: 'feedback_submitted',
        event_category: 'feedback',
        user_type: userType,
        metadata: {
          feedback_type: feedback.feedback_type,
          satisfaction_score: feedback.satisfaction_score,
        },
      });

      return { success: true, feedbackId: data.id };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Récupérer les feedbacks de l'utilisateur courant
   */
  async getUserFeedbacks(): Promise<Feedback[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user feedbacks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user feedbacks:', error);
      return [];
    }
  },

  /**
   * Récupérer le résumé des feedbacks (admin)
   */
  async getFeedbackSummary(): Promise<FeedbackSummary[]> {
    try {
      const { data, error } = await supabase
        .from('feedback_summary')
        .select('*');

      if (error) {
        console.error('Error fetching feedback summary:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching feedback summary:', error);
      return [];
    }
  },

  /**
   * Récupérer tous les feedbacks détaillés (admin)
   * Utilise une fonction RPC pour contourner les RLS policies
   */
  async getAllFeedbacks(): Promise<Feedback[]> {
    try {
      // Utiliser la fonction RPC qui a SECURITY DEFINER
      const { data, error } = await supabase.rpc('get_all_feedbacks');

      if (error) {
        console.error('Error fetching all feedbacks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching all feedbacks:', error);
      return [];
    }
  },

  /**
   * Mettre à jour un feedback (utilisateur)
   */
  async updateFeedback(
    feedbackId: string,
    updates: Partial<Pick<FeedbackSubmission, 'message' | 'satisfaction_score'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update(updates)
        .eq('id', feedbackId)
        .eq('status', 'new'); // Seulement si encore nouveau

      if (error) {
        console.error('Error updating feedback:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating feedback:', error);
      return { success: false, error: String(error) };
    }
  },

  /**
   * Helpers pour feedback rapide
   */
  submitQuickFeedback: async (
    message: string,
    userType: UserType,
    satisfactionScore?: number
  ) => {
    return feedbackService.submitFeedback(
      {
        feedback_type: 'other',
        message,
        satisfaction_score: satisfactionScore,
      },
      userType
    );
  },

  submitBugReport: async (
    title: string,
    message: string,
    userType: UserType
  ) => {
    return feedbackService.submitFeedback(
      {
        feedback_type: 'bug',
        category: 'other',
        title,
        message,
      },
      userType
    );
  },

  submitFeatureRequest: async (
    title: string,
    message: string,
    userType: UserType
  ) => {
    return feedbackService.submitFeedback(
      {
        feedback_type: 'feature_request',
        category: 'feature',
        title,
        message,
      },
      userType
    );
  },
};

export default feedbackService;
