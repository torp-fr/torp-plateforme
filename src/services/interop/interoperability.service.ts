/**
 * InteroperabilityService - Liaison des acteurs d'un projet
 * Gestion des participants, notifications cross-profile et documents partagés
 */

import { supabase } from '@/lib/supabase';
import {
  UserType,
  UserRole,
  ProjectActor,
  ProjectPermission,
  PermissionResource,
  PermissionAction,
  ActorNotification,
  NotificationType,
  NotificationAction,
  SharedDocument,
  SharedDocumentType,
  DocumentSignature,
  AuditEvent,
  CrossProfileConfig,
  ProfileFlow,
  NotificationRule,
} from '@/types/profile.types';
import { MessagingService } from '@/services/messaging/messaging.service';

// =============================================================================
// CONFIGURATION CROSS-PROFILE
// =============================================================================

const DEFAULT_CROSS_PROFILE_CONFIG: CrossProfileConfig = {
  allowedFlows: [
    // B2C ↔ B2B
    { from: 'B2C', to: 'B2B', flowType: 'project', description: 'Client engage entreprise', autoCreateConversation: true },
    { from: 'B2B', to: 'B2C', flowType: 'proposal', description: 'Entreprise propose au client', autoCreateConversation: true },

    // B2G ↔ B2B
    { from: 'B2G', to: 'B2B', flowType: 'tender', description: 'Collectivité publie marché', autoCreateConversation: false },
    { from: 'B2B', to: 'B2G', flowType: 'response', description: 'Entreprise répond au marché', autoCreateConversation: true },

    // Admin ↔ All
    { from: 'admin', to: 'B2C', flowType: 'support', description: 'Support client', autoCreateConversation: true },
    { from: 'admin', to: 'B2B', flowType: 'support', description: 'Support entreprise', autoCreateConversation: true },
    { from: 'admin', to: 'B2G', flowType: 'support', description: 'Support collectivité', autoCreateConversation: true },
  ],

  notificationRules: [
    // Jalons
    { event: 'milestone_submitted', notifyRoles: ['client'], priority: 'high', channels: ['app', 'email'] },
    { event: 'milestone_validated', notifyRoles: ['entreprise'], priority: 'high', channels: ['app', 'email'] },
    { event: 'milestone_rejected', notifyRoles: ['entreprise'], priority: 'urgent', channels: ['app', 'email', 'sms'] },

    // Paiements
    { event: 'payment_requested', notifyRoles: ['client'], priority: 'high', channels: ['app', 'email'] },
    { event: 'payment_received', notifyRoles: ['entreprise'], priority: 'normal', channels: ['app', 'email'] },
    { event: 'payment_released', notifyRoles: ['entreprise'], priority: 'high', channels: ['app', 'email'] },

    // Litiges
    { event: 'dispute_opened', notifyRoles: ['entreprise', 'client', 'admin'], priority: 'urgent', channels: ['app', 'email', 'sms'] },
    { event: 'dispute_response_required', notifyRoles: ['entreprise', 'client'], priority: 'urgent', channels: ['app', 'email'] },
    { event: 'dispute_resolved', notifyRoles: ['entreprise', 'client'], priority: 'high', channels: ['app', 'email'] },

    // Messages
    { event: 'new_message', notifyRoles: ['owner', 'client', 'entreprise', 'collaborator'], priority: 'normal', channels: ['app'] },
    { event: 'mention', notifyRoles: ['owner', 'client', 'entreprise', 'collaborator'], priority: 'high', channels: ['app', 'email'] },
  ],

  defaultSharedDocuments: ['cctp', 'dpgf', 'contract', 'pv_reception'],
};

// Permissions par défaut selon le rôle
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ProjectPermission[]> = {
  owner: [
    { resource: 'project', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
    { resource: 'project.details', actions: ['view', 'edit'] },
    { resource: 'project.documents', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { resource: 'project.budget', actions: ['view', 'edit'] },
    { resource: 'milestones', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { resource: 'payments', actions: ['view', 'create', 'approve'] },
    { resource: 'messages', actions: ['view', 'create'] },
    { resource: 'disputes', actions: ['view', 'create'] },
    { resource: 'team', actions: ['view', 'create', 'edit', 'delete'] },
    { resource: 'analytics', actions: ['view', 'export'] },
  ],
  client: [
    { resource: 'project', actions: ['view'] },
    { resource: 'project.details', actions: ['view'] },
    { resource: 'project.documents', actions: ['view', 'export'] },
    { resource: 'project.budget', actions: ['view'] },
    { resource: 'milestones', actions: ['view', 'approve'] },
    { resource: 'payments', actions: ['view', 'create'] },
    { resource: 'messages', actions: ['view', 'create'] },
    { resource: 'disputes', actions: ['view', 'create'] },
    { resource: 'team', actions: ['view'] },
    { resource: 'analytics', actions: ['view'] },
  ],
  entreprise: [
    { resource: 'project', actions: ['view'] },
    { resource: 'project.details', actions: ['view'] },
    { resource: 'project.documents', actions: ['view', 'create', 'export'] },
    { resource: 'project.budget', actions: ['view'] },
    { resource: 'milestones', actions: ['view', 'create', 'edit'] },
    { resource: 'payments', actions: ['view'] },
    { resource: 'messages', actions: ['view', 'create'] },
    { resource: 'disputes', actions: ['view', 'create'] },
    { resource: 'team', actions: ['view'] },
    { resource: 'analytics', actions: ['view'] },
  ],
  collaborator: [
    { resource: 'project', actions: ['view'] },
    { resource: 'project.details', actions: ['view'] },
    { resource: 'project.documents', actions: ['view'] },
    { resource: 'milestones', actions: ['view'] },
    { resource: 'payments', actions: ['view'] },
    { resource: 'messages', actions: ['view', 'create'] },
    { resource: 'team', actions: ['view'] },
  ],
  viewer: [
    { resource: 'project', actions: ['view'] },
    { resource: 'project.details', actions: ['view'] },
    { resource: 'project.documents', actions: ['view'] },
    { resource: 'milestones', actions: ['view'] },
    { resource: 'payments', actions: ['view'] },
    { resource: 'messages', actions: ['view'] },
  ],
  admin: [
    { resource: 'project', actions: ['view', 'edit', 'delete', 'approve'] },
    { resource: 'project.details', actions: ['view', 'edit'] },
    { resource: 'project.documents', actions: ['view', 'export'] },
    { resource: 'project.budget', actions: ['view'] },
    { resource: 'milestones', actions: ['view', 'approve'] },
    { resource: 'payments', actions: ['view', 'approve'] },
    { resource: 'messages', actions: ['view'] },
    { resource: 'disputes', actions: ['view', 'create', 'edit', 'approve'] },
    { resource: 'team', actions: ['view'] },
    { resource: 'analytics', actions: ['view', 'export'] },
  ],
  mediator: [
    { resource: 'project', actions: ['view'] },
    { resource: 'project.documents', actions: ['view'] },
    { resource: 'milestones', actions: ['view'] },
    { resource: 'payments', actions: ['view'] },
    { resource: 'messages', actions: ['view', 'create'] },
    { resource: 'disputes', actions: ['view', 'create', 'edit', 'approve'] },
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

export class InteroperabilityService {
  // ============================
  // GESTION DES ACTEURS
  // ============================

  /**
   * Lie des acteurs à un projet
   */
  static async linkProjectActors(
    projectId: string,
    actors: Array<{
      userId: string;
      userType: UserType;
      role: UserRole;
    }>
  ): Promise<{ success: boolean; actors?: ProjectActor[]; error?: string }> {
    try {
      const actorsToInsert = await Promise.all(
        actors.map(async (actor) => {
          // Récupérer les infos utilisateur
          const { data: user } = await supabase
            .from('users')
            .select('full_name, email, phone, avatar_url, company_name, company_siret, entity_name, entity_type')
            .eq('id', actor.userId)
            .single();

          return {
            project_id: projectId,
            user_id: actor.userId,
            user_type: actor.userType,
            role: actor.role,
            display_name: user?.full_name || 'Utilisateur',
            email: user?.email || '',
            phone: user?.phone,
            avatar: user?.avatar_url,
            company_name: user?.company_name,
            company_siret: user?.company_siret,
            entity_name: user?.entity_name,
            entity_type: user?.entity_type,
            permissions: DEFAULT_ROLE_PERMISSIONS[actor.role],
            status: 'active',
            joined_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          };
        })
      );

      const { data, error } = await supabase
        .from('project_actors')
        .upsert(actorsToInsert, { onConflict: 'project_id,user_id' })
        .select();

      if (error) throw error;

      // Créer automatiquement une conversation projet si configuré
      const flow = DEFAULT_CROSS_PROFILE_CONFIG.allowedFlows.find(
        (f) => f.autoCreateConversation && actors.some((a) => a.userType === f.from || a.userType === f.to)
      );

      if (flow && actors.length >= 2) {
        const ownerId = actors.find((a) => a.role === 'owner')?.userId || actors[0].userId;
        const participantIds = actors.filter((a) => a.userId !== ownerId).map((a) => a.userId);

        await MessagingService.createConversation(
          {
            type: 'project',
            projectId,
            participantIds,
            titre: 'Espace projet',
          },
          ownerId
        );
      }

      // Logger l'événement
      await this.logAuditEvent({
        actorId: actors[0].userId,
        actorType: actors[0].userType,
        actorName: actorsToInsert[0].display_name,
        action: 'actors_linked',
        resource: 'project_actors',
        resourceId: projectId,
        projectId,
        details: { actorCount: actors.length },
      });

      return {
        success: true,
        actors: (data || []).map((row) => this.mapActorFromDB(row)),
      };
    } catch (error) {
      console.error('Erreur liaison acteurs:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Récupère tous les acteurs d'un projet
   */
  static async getProjectActors(projectId: string): Promise<ProjectActor[]> {
    const { data, error } = await supabase
      .from('project_actors')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => this.mapActorFromDB(row));
  }

  /**
   * Récupère un acteur spécifique
   */
  static async getActor(projectId: string, userId: string): Promise<ProjectActor | null> {
    const { data, error } = await supabase
      .from('project_actors')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return this.mapActorFromDB(data);
  }

  /**
   * Met à jour le rôle d'un acteur
   */
  static async updateActorRole(
    projectId: string,
    userId: string,
    newRole: UserRole,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const newPermissions = DEFAULT_ROLE_PERMISSIONS[newRole];

      const { error } = await supabase
        .from('project_actors')
        .update({
          role: newRole,
          permissions: newPermissions,
        })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      // Notifier l'utilisateur
      await this.notifyActor(userId, 'project_updated', {
        projectId,
        title: 'Rôle modifié',
        message: `Votre rôle sur le projet a été modifié : ${newRole}`,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Retire un acteur d'un projet
   */
  static async removeActor(
    projectId: string,
    userId: string,
    removedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('project_actors')
        .update({ status: 'removed' })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      // Notifier
      await this.notifyActor(userId, 'project_updated', {
        projectId,
        title: 'Accès révoqué',
        message: 'Votre accès au projet a été révoqué.',
        priority: 'high',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Invite un nouvel acteur
   */
  static async inviteActor(
    projectId: string,
    email: string,
    role: UserRole,
    invitedBy: string,
    inviterName: string
  ): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    try {
      // Vérifier si l'utilisateur existe déjà
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, user_type')
        .eq('email', email)
        .single();

      if (existingUser) {
        // Utilisateur existant - lier directement
        await this.linkProjectActors(projectId, [
          {
            userId: existingUser.id,
            userType: existingUser.user_type as UserType,
            role,
          },
        ]);

        // Notifier
        await this.notifyActor(existingUser.id, 'actor_invited', {
          projectId,
          title: 'Invitation projet',
          message: `${inviterName} vous a invité à rejoindre un projet.`,
          priority: 'high',
          actions: [
            { id: 'accept', label: 'Voir le projet', type: 'primary', route: `/project/${projectId}` },
          ],
        });

        return { success: true, invitationId: existingUser.id };
      }

      // Nouvel utilisateur - créer une invitation
      const { data: invitation, error } = await supabase
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email,
          role,
          invited_by: invitedBy,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
        })
        .select()
        .single();

      if (error) throw error;

      // Envoyer l'email d'invitation (via edge function)
      console.log('📧 Invitation envoyée à:', email);

      return { success: true, invitationId: invitation?.id };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================
  // NOTIFICATIONS CROSS-PROFILE
  // ============================

  /**
   * Notifie un acteur spécifique
   */
  static async notifyActor(
    recipientId: string,
    type: NotificationType,
    data: {
      projectId?: string;
      projectName?: string;
      resourceId?: string;
      resourceType?: string;
      title: string;
      message: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      actions?: NotificationAction[];
      senderId?: string;
      senderName?: string;
      senderType?: UserType;
    }
  ): Promise<{ success: boolean; notificationId?: string }> {
    try {
      // Récupérer le type de l'utilisateur destinataire
      const { data: recipient } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', recipientId)
        .single();

      const notification: Omit<ActorNotification, 'id' | 'createdAt'> = {
        type,
        recipientId,
        recipientType: (recipient?.user_type as UserType) || 'B2C',
        senderId: data.senderId,
        senderName: data.senderName,
        senderType: data.senderType,
        projectId: data.projectId,
        projectName: data.projectName,
        resourceId: data.resourceId,
        resourceType: data.resourceType,
        title: data.title,
        message: data.message,
        data: {},
        actions: data.actions,
        priority: data.priority || 'normal',
        read: false,
      };

      const { data: inserted, error } = await supabase
        .from('actor_notifications')
        .insert({
          ...notification,
          data: notification.data,
        })
        .select()
        .single();

      if (error) throw error;

      // Vérifier les règles de notification pour envoi multi-canal
      const rule = DEFAULT_CROSS_PROFILE_CONFIG.notificationRules.find((r) => r.event === type);
      if (rule) {
        // Envoyer via les canaux configurés
        for (const channel of rule.channels) {
          if (channel === 'email') {
            console.log('📧 Email notification à', recipientId);
            // await EmailService.send(...)
          } else if (channel === 'sms' && rule.priority === 'urgent') {
            console.log('📱 SMS notification à', recipientId);
            // await SMSService.send(...)
          }
        }
      }

      return { success: true, notificationId: inserted?.id };
    } catch (error) {
      console.error('Erreur notification:', error);
      return { success: false };
    }
  }

  /**
   * Notifie tous les acteurs d'un projet selon leurs rôles
   */
  static async notifyProjectActors(
    projectId: string,
    type: NotificationType,
    data: {
      title: string;
      message: string;
      resourceId?: string;
      resourceType?: string;
      excludeUserId?: string;
      senderId?: string;
      senderName?: string;
      senderType?: UserType;
    },
    targetRoles?: UserRole[]
  ): Promise<void> {
    try {
      // Récupérer les acteurs du projet
      const actors = await this.getProjectActors(projectId);

      // Filtrer par rôle si spécifié
      const rule = DEFAULT_CROSS_PROFILE_CONFIG.notificationRules.find((r) => r.event === type);
      const rolesToNotify = targetRoles || rule?.notifyRoles || ['owner', 'client', 'entreprise'];

      const filteredActors = actors.filter(
        (actor) =>
          rolesToNotify.includes(actor.role) &&
          actor.userId !== data.excludeUserId &&
          actor.status === 'active'
      );

      // Envoyer les notifications
      await Promise.all(
        filteredActors.map((actor) =>
          this.notifyActor(actor.userId, type, {
            ...data,
            projectId,
            priority: rule?.priority || 'normal',
          })
        )
      );
    } catch (error) {
      console.error('Erreur notification projet:', error);
    }
  }

  /**
   * Récupère les notifications d'un utilisateur
   */
  static async getUserNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<ActorNotification[]> {
    let query = supabase
      .from('actor_notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((row) => this.mapNotificationFromDB(row));
  }

  /**
   * Marque des notifications comme lues
   */
  static async markNotificationsRead(
    notificationIds: string[],
    userId: string
  ): Promise<void> {
    await supabase
      .from('actor_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', notificationIds)
      .eq('recipient_id', userId);
  }

  // ============================
  // DOCUMENTS PARTAGÉS
  // ============================

  /**
   * Partage un document avec les acteurs du projet
   */
  static async shareDocument(
    projectId: string,
    document: {
      documentType: SharedDocumentType;
      name: string;
      description?: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    },
    sharedBy: string,
    sharedByName: string,
    options?: {
      sharedWith?: string[];
      visibleToRoles?: UserRole[];
      allowDownload?: boolean;
      requiresSignature?: boolean;
    }
  ): Promise<{ document?: SharedDocument; error?: string }> {
    try {
      // Par défaut, partager avec tous les acteurs actifs
      let sharedWith = options?.sharedWith;
      if (!sharedWith) {
        const actors = await this.getProjectActors(projectId);
        sharedWith = actors.map((a) => a.userId);
      }

      const { data, error } = await supabase
        .from('shared_documents')
        .insert({
          project_id: projectId,
          document_type: document.documentType,
          name: document.name,
          description: document.description,
          file_url: document.fileUrl,
          file_size: document.fileSize,
          mime_type: document.mimeType,
          shared_by: sharedBy,
          shared_by_name: sharedByName,
          shared_with: sharedWith,
          visible_to_roles: options?.visibleToRoles || ['owner', 'client', 'entreprise', 'collaborator'],
          allow_download: options?.allowDownload ?? true,
          allow_comment: true,
          requires_signature: options?.requiresSignature ?? false,
          status: 'shared',
        })
        .select()
        .single();

      if (error) throw error;

      // Notifier les destinataires
      await this.notifyProjectActors(projectId, 'project_updated', {
        title: 'Nouveau document',
        message: `${sharedByName} a partagé le document "${document.name}"`,
        resourceId: data?.id,
        resourceType: 'document',
        excludeUserId: sharedBy,
        senderId: sharedBy,
        senderName: sharedByName,
      });

      return { document: this.mapDocumentFromDB(data) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  /**
   * Récupère les documents partagés d'un projet
   */
  static async getSharedDocuments(
    projectId: string,
    userId: string
  ): Promise<SharedDocument[]> {
    // Récupérer le rôle de l'utilisateur
    const actor = await this.getActor(projectId, userId);
    if (!actor) return [];

    const { data, error } = await supabase
      .from('shared_documents')
      .select('*')
      .eq('project_id', projectId)
      .contains('visible_to_roles', [actor.role])
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => this.mapDocumentFromDB(row));
  }

  /**
   * Signe un document
   */
  static async signDocument(
    documentId: string,
    userId: string,
    userName: string,
    userType: UserType,
    signatureData: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Récupérer le document
      const { data: doc, error: fetchError } = await supabase
        .from('shared_documents')
        .select('signatures')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      const signatures = (doc?.signatures || []) as DocumentSignature[];

      // Vérifier si déjà signé
      if (signatures.some((s) => s.userId === userId)) {
        return { success: false, error: 'Document déjà signé' };
      }

      // Ajouter la signature
      signatures.push({
        userId,
        userName,
        userType,
        signedAt: new Date(),
        signatureData,
        ipAddress,
      });

      const { error: updateError } = await supabase
        .from('shared_documents')
        .update({
          signatures,
          status: 'signed',
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================
  // AUDIT TRAIL
  // ============================

  /**
   * Enregistre un événement d'audit
   */
  static async logAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<void> {
    try {
      await supabase.from('audit_events').insert({
        actor_id: event.actorId,
        actor_type: event.actorType,
        actor_name: event.actorName,
        action: event.action,
        resource: event.resource,
        resource_id: event.resourceId,
        project_id: event.projectId,
        details: event.details,
        previous_value: event.previousValue,
        new_value: event.newValue,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
      });
    } catch (error) {
      console.error('Erreur audit log:', error);
    }
  }

  /**
   * Récupère l'historique d'audit d'un projet
   */
  static async getProjectAuditLog(
    projectId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AuditEvent[]> {
    let query = supabase
      .from('audit_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      actorType: row.actor_type,
      actorName: row.actor_name,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      projectId: row.project_id,
      details: row.details,
      previousValue: row.previous_value,
      newValue: row.new_value,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at),
    }));
  }

  // ============================
  // MAPPINGS
  // ============================

  private static mapActorFromDB(row: Record<string, unknown>): ProjectActor {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      userType: row.user_type as UserType,
      role: row.role as UserRole,
      displayName: row.display_name as string,
      email: row.email as string,
      phone: row.phone as string | undefined,
      avatar: row.avatar as string | undefined,
      companyName: row.company_name as string | undefined,
      companySiret: row.company_siret as string | undefined,
      entityName: row.entity_name as string | undefined,
      entityType: row.entity_type as string | undefined,
      permissions: row.permissions as ProjectPermission[],
      status: row.status as ProjectActor['status'],
      invitedAt: row.invited_at ? new Date(row.invited_at as string) : undefined,
      joinedAt: row.joined_at ? new Date(row.joined_at as string) : undefined,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }

  private static mapNotificationFromDB(row: Record<string, unknown>): ActorNotification {
    return {
      id: row.id as string,
      type: row.type as NotificationType,
      recipientId: row.recipient_id as string,
      recipientType: row.recipient_type as UserType,
      senderId: row.sender_id as string | undefined,
      senderName: row.sender_name as string | undefined,
      senderType: row.sender_type as UserType | undefined,
      projectId: row.project_id as string | undefined,
      projectName: row.project_name as string | undefined,
      resourceId: row.resource_id as string | undefined,
      resourceType: row.resource_type as string | undefined,
      title: row.title as string,
      message: row.message as string,
      data: row.data as Record<string, unknown> | undefined,
      actions: row.actions as NotificationAction[] | undefined,
      priority: row.priority as ActorNotification['priority'],
      read: row.read as boolean,
      readAt: row.read_at ? new Date(row.read_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    };
  }

  private static mapDocumentFromDB(row: Record<string, unknown>): SharedDocument {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      documentType: row.document_type as SharedDocumentType,
      name: row.name as string,
      description: row.description as string | undefined,
      fileUrl: row.file_url as string,
      fileSize: row.file_size as number,
      mimeType: row.mime_type as string,
      sharedBy: row.shared_by as string,
      sharedByName: row.shared_by_name as string,
      sharedWith: row.shared_with as string[],
      visibleToRoles: row.visible_to_roles as UserRole[],
      allowDownload: row.allow_download as boolean,
      allowComment: row.allow_comment as boolean,
      requiresSignature: row.requires_signature as boolean,
      signatures: row.signatures as DocumentSignature[] | undefined,
      status: row.status as SharedDocument['status'],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    };
  }
}

export default InteroperabilityService;
