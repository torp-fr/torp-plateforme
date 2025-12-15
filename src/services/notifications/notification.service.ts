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
  | 'fraud_alert'
  | 'fraud_blocked'
  | 'payment_milestone'
  | 'payment_released'
  | 'payment_dispute'
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

  // =====================================================
  // NOTIFICATIONS DE FRAUDE
  // =====================================================

  /**
   * Notifie une alerte de fraude détectée (niveau moyen/élevé)
   */
  async notifyFraudAlert(params: {
    userId: string;
    userEmail: string;
    userName: string;
    contractId: string;
    riskLevel: 'medium' | 'high' | 'critical';
    rulesTriggered: string[];
    montant: number;
    entrepriseName: string;
  }): Promise<void> {
    const levelLabel = {
      medium: 'Vigilance requise',
      high: 'Risque élevé',
      critical: 'Risque critique',
    }[params.riskLevel];

    await this.create({
      userId: params.userId,
      type: 'fraud_alert',
      title: `Alerte sécurité : ${levelLabel}`,
      message: `Une demande de paiement de ${params.montant.toLocaleString('fr-FR')}€ nécessite votre attention. ${params.rulesTriggered.length} point(s) d'alerte détecté(s).`,
      data: {
        contractId: params.contractId,
        riskLevel: params.riskLevel,
        rulesTriggered: params.rulesTriggered,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        levelLabel,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
        rulesTriggered: params.rulesTriggered,
        contractId: params.contractId,
      },
    });
  }

  /**
   * Notifie un paiement bloqué pour fraude
   */
  async notifyFraudBlocked(params: {
    userId: string;
    userEmail: string;
    userName: string;
    contractId: string;
    montant: number;
    entrepriseName: string;
    reason: string;
  }): Promise<void> {
    await this.create({
      userId: params.userId,
      type: 'fraud_blocked',
      title: 'Paiement bloqué par sécurité',
      message: `Un paiement de ${params.montant.toLocaleString('fr-FR')}€ a été bloqué pour protéger vos intérêts. Raison: ${params.reason}`,
      data: {
        contractId: params.contractId,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
        reason: params.reason,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
        reason: params.reason,
      },
    });
  }

  /**
   * Notifie les administrateurs d'une alerte critique
   */
  async notifyAdminFraudCritical(params: {
    contractId: string;
    userId: string;
    entrepriseId: string;
    riskScore: number;
    rulesTriggered: string[];
    montant: number;
    details: Record<string, unknown>;
  }): Promise<void> {
    // Récupérer les admins
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'admin');

    if (!admins || admins.length === 0) {
      console.warn('[NotificationService] Aucun admin trouvé pour alerte fraude critique');
      return;
    }

    for (const admin of admins) {
      await this.create({
        userId: admin.id,
        type: 'fraud_alert',
        title: `ALERTE CRITIQUE - Score fraude: ${params.riskScore}`,
        message: `Contrat ${params.contractId}: ${params.rulesTriggered.length} règles déclenchées pour ${params.montant.toLocaleString('fr-FR')}€`,
        data: {
          ...params,
          adminNotification: true,
        },
        sendEmail: true,
        emailParams: {
          to: admin.email,
          userName: admin.name,
          isAdmin: true,
          ...params,
        },
      });
    }
  }

  // =====================================================
  // NOTIFICATIONS DE PAIEMENT
  // =====================================================

  /**
   * Notifie qu'un jalon de paiement est dû
   */
  async notifyPaymentMilestoneDue(params: {
    userId: string;
    userEmail: string;
    userName: string;
    projectName: string;
    milestoneName: string;
    montant: number;
    dueDate: string;
    contractId: string;
  }): Promise<void> {
    await this.create({
      userId: params.userId,
      type: 'payment_milestone',
      title: `Jalon de paiement à venir : ${params.milestoneName}`,
      message: `Le jalon "${params.milestoneName}" (${params.montant.toLocaleString('fr-FR')}€) pour le projet "${params.projectName}" est prévu pour le ${new Date(params.dueDate).toLocaleDateString('fr-FR')}.`,
      data: {
        projectName: params.projectName,
        milestoneName: params.milestoneName,
        montant: params.montant,
        dueDate: params.dueDate,
        contractId: params.contractId,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        projectName: params.projectName,
        milestoneName: params.milestoneName,
        montant: params.montant,
        dueDate: params.dueDate,
      },
    });
  }

  /**
   * Notifie qu'un paiement a été libéré
   */
  async notifyPaymentReleased(params: {
    userId: string;
    userEmail: string;
    userName: string;
    projectName: string;
    montant: number;
    entrepriseName: string;
    milestoneDescription?: string;
  }): Promise<void> {
    await this.create({
      userId: params.userId,
      type: 'payment_released',
      title: 'Paiement libéré avec succès',
      message: `Le paiement de ${params.montant.toLocaleString('fr-FR')}€ pour "${params.projectName}" a été libéré vers ${params.entrepriseName}.`,
      data: {
        projectName: params.projectName,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
        milestoneDescription: params.milestoneDescription,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        projectName: params.projectName,
        montant: params.montant,
        entrepriseName: params.entrepriseName,
      },
    });
  }

  /**
   * Notifie l'ouverture d'un litige
   */
  async notifyDisputeOpened(params: {
    userId: string;
    userEmail: string;
    userName: string;
    disputeId: string;
    projectName: string;
    montant: number;
    reason: string;
    isClient: boolean;
  }): Promise<void> {
    const role = params.isClient ? 'Client' : 'Entreprise';
    await this.create({
      userId: params.userId,
      type: 'payment_dispute',
      title: 'Litige ouvert sur votre projet',
      message: `Un litige a été ouvert concernant le paiement de ${params.montant.toLocaleString('fr-FR')}€ sur "${params.projectName}". Motif: ${params.reason}`,
      data: {
        disputeId: params.disputeId,
        projectName: params.projectName,
        montant: params.montant,
        reason: params.reason,
        role,
      },
      sendEmail: true,
      emailParams: {
        to: params.userEmail,
        userName: params.userName,
        disputeId: params.disputeId,
        projectName: params.projectName,
        montant: params.montant,
        reason: params.reason,
      },
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
