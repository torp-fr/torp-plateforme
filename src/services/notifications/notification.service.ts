/**
 * Notification Service
 * Service de gestion des notifications in-app et email
 */

import { supabase } from '@/lib/supabase';
import { emailService } from '@/services/email/email.service';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  email_sent: boolean;
  created_at: string;
}

export type NotificationType =
  | 'analysis_complete'
  | 'welcome'
  | 'ticket_generated'
  | 'document_expiring'
  | 'comparison_complete'
  | 'general';

class NotificationService {
  /**
   * Crée une notification et envoie l'email si configuré
   */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message?: string;
    data?: Record<string, unknown>;
    sendEmail?: boolean;
    emailParams?: Record<string, unknown>;
  }): Promise<Notification | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message || null,
          data: params.data || null,
          email_sent: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[NotificationService] Erreur création:', error);
        return null;
      }

      // Envoi email si demandé
      if (params.sendEmail && params.emailParams) {
        const emailResult = await this.sendEmailForType(params.type, params.emailParams);

        if (emailResult.success) {
          await supabase
            .from('notifications')
            .update({ email_sent: true })
            .eq('id', data.id);
        }
      }

      return data;
    } catch (err) {
      console.error('[NotificationService] Exception:', err);
      return null;
    }
  }

  /**
   * Récupère les notifications non lues
   */
  async getUnread(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[NotificationService] Erreur getUnread:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Récupère toutes les notifications
   */
  async getAll(userId: string, limit: number = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[NotificationService] Erreur getAll:', error);
      return [];
    }
    return data || [];
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[NotificationService] Erreur markAsRead:', error);
    }
  }

  /**
   * Marque toutes les notifications comme lues
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('[NotificationService] Erreur markAllAsRead:', error);
    }
  }

  /**
   * Compte les non lues
   */
  async countUnread(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('[NotificationService] Erreur countUnread:', error);
      return 0;
    }
    return count || 0;
  }

  /**
   * Supprime une notification
   */
  async delete(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('[NotificationService] Erreur delete:', error);
    }
  }

  /**
   * Envoie l'email approprié selon le type
   */
  private async sendEmailForType(
    type: NotificationType,
    params: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    switch (type) {
      case 'analysis_complete':
        return emailService.sendAnalysisComplete(params as any);
      case 'welcome':
        return emailService.sendWelcome(params as any);
      case 'ticket_generated':
        return emailService.sendTicketGenerated(params as any);
      case 'document_expiring':
        return emailService.sendDocumentExpiringSoon(params as any);
      default:
        return { success: false, error: 'Type email non supporté' };
    }
  }

  // =====================================================
  // HELPERS POUR CRÉATION RAPIDE
  // =====================================================

  /**
   * Notifie qu'une analyse est terminée
   */
  async notifyAnalysisComplete(params: {
    userId: string;
    userEmail: string;
    userName: string;
    projectName: string;
    entrepriseName: string;
    grade: string;
    score: number;
    analysisId: string;
  }): Promise<void> {
    await this.create({
      userId: params.userId,
      type: 'analysis_complete',
      title: `Analyse terminée : ${params.grade} (${params.score}/1000)`,
      message: `Votre devis "${params.projectName}" a été analysé.`,
      data: {
        analysisId: params.analysisId,
        grade: params.grade,
        score: params.score,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        projectName: params.projectName,
        entrepriseName: params.entrepriseName,
        grade: params.grade,
        score: params.score,
        analysisId: params.analysisId,
      },
    });
  }

  /**
   * Notifie un nouvel utilisateur (bienvenue)
   */
  async notifyWelcome(params: {
    userId: string;
    userEmail: string;
    userName: string;
    userType: 'B2C' | 'B2B';
  }): Promise<void> {
    await this.create({
      userId: params.userId,
      type: 'welcome',
      title: `Bienvenue sur TORP ${params.userType === 'B2B' ? 'Pro' : ''} !`,
      message: 'Votre compte est maintenant actif.',
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        userType: params.userType,
      },
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
