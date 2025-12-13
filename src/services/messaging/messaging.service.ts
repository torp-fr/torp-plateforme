/**
 * MessagingService - Messagerie projet temps réel
 * Communication entre acteurs d'un projet avec Supabase Realtime
 */

import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Conversation,
  Message,
  ConversationParticipant,
  SendMessageInput,
  CreateConversationInput,
  ConversationListFilters,
  TypingIndicator,
  MessageType,
  MessageStatus,
  ConversationType,
  MessageMetadata,
  MessageAttachment,
} from '@/types/messaging.types';

// Configuration
const MESSAGING_CONFIG = {
  maxMessageLength: 10000,
  maxAttachments: 10,
  maxFileSize: 25 * 1024 * 1024, // 25 Mo
  typingTimeout: 3000, // 3 secondes
  messagesPerPage: 50,
};

// Channels actifs pour le temps réel
const activeChannels: Map<string, RealtimeChannel> = new Map();

export class MessagingService {
  // ============================
  // CONVERSATIONS
  // ============================

  /**
   * Crée une nouvelle conversation
   */
  static async createConversation(
    input: CreateConversationInput,
    creatorId: string
  ): Promise<{ conversation?: Conversation; error?: string }> {
    try {
      // Vérifier qu'une conversation directe n'existe pas déjà
      if (input.type === 'direct' && input.participantIds.length === 1) {
        const existing = await this.findDirectConversation(creatorId, input.participantIds[0]);
        if (existing) {
          return { conversation: existing };
        }
      }

      // Créer la conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: input.type,
          project_id: input.projectId,
          contract_id: input.contractId,
          titre: input.titre,
          settings: {
            allowFiles: true,
            allowImages: true,
            maxFileSize: MESSAGING_CONFIG.maxFileSize,
            notifyOnNewMessage: true,
            notifyOnMention: true,
            requireApproval: false,
          },
          created_by: creatorId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Ajouter les participants
      const participants = [
        { conversation_id: conversation.id, user_id: creatorId, role: 'owner' },
        ...input.participantIds.map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
          role: 'member',
        })),
      ];

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      // Envoyer le message initial si fourni
      if (input.initialMessage) {
        await this.sendMessage({
          conversationId: conversation.id,
          content: input.initialMessage,
        }, creatorId);
      } else {
        // Message système de création
        await this.sendSystemMessage(
          conversation.id,
          'Conversation créée',
          { systemAction: 'conversation_created' }
        );
      }

      // Récupérer la conversation complète
      const fullConversation = await this.getConversation(conversation.id, creatorId);
      return { conversation: fullConversation || undefined };
    } catch (error) {
      console.error('Erreur création conversation:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * Récupère une conversation par ID
   */
  static async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants (
          user_id,
          role,
          joined_at,
          last_read_at,
          last_read_message_id,
          notifications_enabled,
          muted_until,
          users:user_id (
            id,
            full_name,
            avatar_url,
            user_type
          )
        ),
        messages (
          id,
          sender_id,
          content,
          type,
          created_at
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !data) return null;

    // Vérifier que l'utilisateur est participant
    const isParticipant = data.conversation_participants.some(
      (p: { user_id: string }) => p.user_id === userId
    );
    if (!isParticipant) return null;

    return this.mapConversationFromDB(data, userId);
  }

  /**
   * Liste les conversations d'un utilisateur
   */
  static async listConversations(
    userId: string,
    filters?: ConversationListFilters
  ): Promise<Conversation[]> {
    let query = supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants!inner (
          user_id,
          role,
          joined_at,
          last_read_at,
          last_read_message_id,
          notifications_enabled,
          muted_until
        )
      `)
      .eq('conversation_participants.user_id', userId);

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters?.isArchived !== undefined) {
      query = query.eq('is_archived', filters.isArchived);
    }
    if (filters?.search) {
      query = query.ilike('titre', `%${filters.search}%`);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Récupérer les derniers messages et participants pour chaque conversation
    const conversations = await Promise.all(
      (data || []).map(async (conv) => {
        // Récupérer tous les participants
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            role,
            joined_at,
            last_read_at,
            users:user_id (full_name, avatar_url, user_type)
          `)
          .eq('conversation_id', conv.id);

        // Récupérer le dernier message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('id, sender_id, content, type, created_at, users:sender_id (full_name)')
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Compter les non-lus
        const userParticipant = conv.conversation_participants[0];
        let unreadCount = 0;
        if (userParticipant?.last_read_at) {
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', userParticipant.last_read_at)
            .neq('sender_id', userId);
          unreadCount = count || 0;
        }

        return {
          ...conv,
          participants: participants || [],
          lastMessage,
          unreadCount,
        };
      })
    );

    return conversations.map(conv => this.mapConversationFromDB(conv, userId));
  }

  /**
   * Trouve une conversation directe existante
   */
  private static async findDirectConversation(
    userId1: string,
    userId2: string
  ): Promise<Conversation | null> {
    const { data } = await supabase
      .from('conversations')
      .select(`
        id,
        conversation_participants (user_id)
      `)
      .eq('type', 'direct');

    if (!data) return null;

    // Trouver la conversation avec exactement ces 2 participants
    for (const conv of data) {
      const participantIds = conv.conversation_participants.map((p: { user_id: string }) => p.user_id);
      if (
        participantIds.length === 2 &&
        participantIds.includes(userId1) &&
        participantIds.includes(userId2)
      ) {
        return this.getConversation(conv.id, userId1);
      }
    }

    return null;
  }

  /**
   * Archive/désarchive une conversation
   */
  static async archiveConversation(
    conversationId: string,
    userId: string,
    archive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: archive, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // ============================
  // MESSAGES
  // ============================

  /**
   * Envoie un message
   */
  static async sendMessage(
    input: SendMessageInput,
    senderId: string
  ): Promise<{ message?: Message; error?: string }> {
    try {
      // Vérifier la longueur
      if (input.content.length > MESSAGING_CONFIG.maxMessageLength) {
        return { error: `Message trop long (max ${MESSAGING_CONFIG.maxMessageLength} caractères)` };
      }

      // Récupérer les infos de l'expéditeur
      const { data: sender } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', senderId)
        .single();

      // Traiter les mentions
      const mentions = await this.processMentions(input.content, input.mentions || []);

      // Uploader les pièces jointes si présentes
      let attachments: MessageAttachment[] = [];
      if (input.attachments && input.attachments.length > 0) {
        attachments = await this.uploadAttachments(input.conversationId, input.attachments);
      }

      // Créer le message
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: senderId,
          sender_name: sender?.full_name,
          sender_avatar: sender?.avatar_url,
          type: input.type || 'text',
          content: input.content,
          attachments: attachments.length > 0 ? attachments : null,
          reply_to_id: input.replyToId,
          mentions: mentions.length > 0 ? mentions : null,
          metadata: input.metadata,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour la conversation
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.conversationId);

      // Envoyer les notifications push aux participants
      await this.notifyParticipants(input.conversationId, senderId, message);

      return { message: this.mapMessageFromDB(message) };
    } catch (error) {
      console.error('Erreur envoi message:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * Envoie un message système
   */
  static async sendSystemMessage(
    conversationId: string,
    content: string,
    metadata?: MessageMetadata
  ): Promise<void> {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: null,
      sender_type: 'system',
      type: 'system',
      content,
      metadata,
      status: 'sent',
    });
  }

  /**
   * Récupère les messages d'une conversation
   */
  static async getMessages(
    conversationId: string,
    userId: string,
    options?: { limit?: number; before?: string }
  ): Promise<Message[]> {
    let query = supabase
      .from('messages')
      .select(`
        *,
        reply_to:reply_to_id (
          id, sender_id, content, type, created_at,
          users:sender_id (full_name)
        )
      `)
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(options?.limit || MESSAGING_CONFIG.messagesPerPage);

    if (options?.before) {
      query = query.lt('created_at', options.before);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Marquer comme lu
    await this.markAsRead(conversationId, userId);

    return (data || []).reverse().map(msg => this.mapMessageFromDB(msg));
  }

  /**
   * Modifie un message
   */
  static async editMessage(
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      return { success: false, error: 'Non autorisé' };
    }

    const { error } = await supabase
      .from('messages')
      .update({
        content: newContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * Supprime un message
   */
  static async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: message } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      return { success: false, error: 'Non autorisé' };
    }

    // Soft delete
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * Ajoute une réaction à un message
   */
  static async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{ success: boolean }> {
    const { data: message } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (!message) return { success: false };

    const reactions = message.reactions || [];
    const existingReaction = reactions.find((r: { emoji: string }) => r.emoji === emoji);

    if (existingReaction) {
      // Vérifier si l'utilisateur a déjà réagi
      const hasReacted = existingReaction.users.some((u: { userId: string }) => u.userId === userId);
      if (hasReacted) {
        // Retirer la réaction
        existingReaction.users = existingReaction.users.filter((u: { userId: string }) => u.userId !== userId);
        existingReaction.count--;
        if (existingReaction.count === 0) {
          reactions.splice(reactions.indexOf(existingReaction), 1);
        }
      } else {
        // Ajouter la réaction
        existingReaction.users.push({ userId, reactedAt: new Date() });
        existingReaction.count++;
      }
    } else {
      // Nouvelle réaction
      reactions.push({
        emoji,
        users: [{ userId, reactedAt: new Date() }],
        count: 1,
      });
    }

    await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', messageId);

    return { success: true };
  }

  // ============================
  // TEMPS RÉEL
  // ============================

  /**
   * S'abonne aux messages d'une conversation
   */
  static subscribeToConversation(
    conversationId: string,
    callbacks: {
      onMessage?: (message: Message) => void;
      onTyping?: (indicator: TypingIndicator) => void;
      onPresence?: (userId: string, status: 'online' | 'offline') => void;
    }
  ): () => void {
    // Éviter les doublons
    if (activeChannels.has(conversationId)) {
      return () => this.unsubscribeFromConversation(conversationId);
    }

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      // Écouter les nouveaux messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (callbacks.onMessage) {
            callbacks.onMessage(this.mapMessageFromDB(payload.new as Record<string, unknown>));
          }
        }
      )
      // Écouter les modifications de messages
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (callbacks.onMessage) {
            callbacks.onMessage(this.mapMessageFromDB(payload.new as Record<string, unknown>));
          }
        }
      )
      // Broadcast pour typing indicators
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (callbacks.onTyping) {
          callbacks.onTyping(payload.payload as TypingIndicator);
        }
      })
      // Présence
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        Object.keys(state).forEach((key) => {
          if (callbacks.onPresence) {
            callbacks.onPresence(key, 'online');
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (callbacks.onPresence) {
          callbacks.onPresence(key, 'offline');
        }
      })
      .subscribe();

    activeChannels.set(conversationId, channel);

    return () => this.unsubscribeFromConversation(conversationId);
  }

  /**
   * Se désabonne d'une conversation
   */
  static unsubscribeFromConversation(conversationId: string): void {
    const channel = activeChannels.get(conversationId);
    if (channel) {
      supabase.removeChannel(channel);
      activeChannels.delete(conversationId);
    }
  }

  /**
   * Envoie un indicateur de frappe
   */
  static async sendTypingIndicator(
    conversationId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void> {
    const channel = activeChannels.get(conversationId);
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          conversationId,
          userId,
          userName,
          isTyping,
          timestamp: new Date(),
        },
      });
    }
  }

  /**
   * Met à jour la présence utilisateur
   */
  static async trackPresence(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const channel = activeChannels.get(conversationId);
    if (channel) {
      await channel.track({ online_at: new Date().toISOString() });
    }
  }

  // ============================
  // UTILITAIRES
  // ============================

  /**
   * Marque les messages comme lus
   */
  static async markAsRead(conversationId: string, userId: string): Promise<void> {
    // Récupérer le dernier message
    const { data: lastMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      await supabase
        .from('conversation_participants')
        .update({
          last_read_at: new Date().toISOString(),
          last_read_message_id: lastMessage.id,
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    }
  }

  /**
   * Traite les mentions dans un message
   */
  private static async processMentions(
    content: string,
    mentionedUserIds: string[]
  ): Promise<{ userId: string; displayName: string; startIndex: number; endIndex: number }[]> {
    const mentions: { userId: string; displayName: string; startIndex: number; endIndex: number }[] = [];

    for (const userId of mentionedUserIds) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (user) {
        const mentionPattern = new RegExp(`@${user.full_name}`, 'gi');
        const match = mentionPattern.exec(content);
        if (match) {
          mentions.push({
            userId,
            displayName: user.full_name,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          });
        }
      }
    }

    return mentions;
  }

  /**
   * Upload les pièces jointes
   */
  private static async uploadAttachments(
    conversationId: string,
    files: File[]
  ): Promise<MessageAttachment[]> {
    const attachments: MessageAttachment[] = [];

    for (const file of files.slice(0, MESSAGING_CONFIG.maxAttachments)) {
      if (file.size > MESSAGING_CONFIG.maxFileSize) {
        console.warn(`Fichier ${file.name} trop volumineux, ignoré`);
        continue;
      }

      const fileName = `${conversationId}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (error) {
        console.error('Erreur upload:', error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      attachments.push({
        id: `att-${Date.now()}-${attachments.length}`,
        type: file.type.startsWith('image/') ? 'image' :
              file.type.includes('pdf') || file.type.includes('document') ? 'document' :
              file.type.startsWith('audio/') ? 'audio' :
              file.type.startsWith('video/') ? 'video' : 'file',
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type,
      });
    }

    return attachments;
  }

  /**
   * Notifie les participants d'un nouveau message
   */
  private static async notifyParticipants(
    conversationId: string,
    senderId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    // Récupérer les participants avec notifications activées
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, notifications_enabled, muted_until')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);

    if (!participants) return;

    for (const participant of participants) {
      // Vérifier si les notifications sont activées et non mutées
      if (!participant.notifications_enabled) continue;
      if (participant.muted_until && new Date(participant.muted_until) > new Date()) continue;

      // Envoyer la notification (via edge function ou service externe)
      console.log('📱 Notification à', participant.user_id, ':', message.content);
    }
  }

  // ============================
  // MAPPINGS
  // ============================

  private static mapConversationFromDB(
    data: Record<string, unknown>,
    userId: string
  ): Conversation {
    const participants = (data.participants || data.conversation_participants || []) as Record<string, unknown>[];
    const userParticipant = participants.find(
      (p) => (p.user_id as string) === userId
    );

    return {
      id: data.id as string,
      type: data.type as ConversationType,
      projectId: data.project_id as string | undefined,
      contractId: data.contract_id as string | undefined,
      titre: data.titre as string | undefined,
      description: data.description as string | undefined,
      avatar: data.avatar as string | undefined,
      participants: participants.map(p => ({
        userId: p.user_id as string,
        role: p.role as ConversationParticipant['role'],
        joinedAt: new Date(p.joined_at as string),
        lastReadAt: p.last_read_at ? new Date(p.last_read_at as string) : undefined,
        lastReadMessageId: p.last_read_message_id as string | undefined,
        displayName: (p.users as Record<string, unknown>)?.full_name as string | undefined,
        avatar: (p.users as Record<string, unknown>)?.avatar_url as string | undefined,
        userType: (p.users as Record<string, unknown>)?.user_type as ConversationParticipant['userType'],
        notificationsEnabled: p.notifications_enabled as boolean,
        mutedUntil: p.muted_until ? new Date(p.muted_until as string) : undefined,
      })),
      lastMessage: data.lastMessage ? {
        id: (data.lastMessage as Record<string, unknown>).id as string,
        senderId: (data.lastMessage as Record<string, unknown>).sender_id as string,
        senderName: ((data.lastMessage as Record<string, unknown>).users as Record<string, unknown>)?.full_name as string || 'Système',
        content: (data.lastMessage as Record<string, unknown>).content as string,
        type: (data.lastMessage as Record<string, unknown>).type as MessageType,
        createdAt: new Date((data.lastMessage as Record<string, unknown>).created_at as string),
      } : undefined,
      unreadCount: (data.unreadCount as number) || 0,
      settings: data.settings as Conversation['settings'] || {
        allowFiles: true,
        allowImages: true,
        maxFileSize: MESSAGING_CONFIG.maxFileSize,
        notifyOnNewMessage: true,
        notifyOnMention: true,
        requireApproval: false,
      },
      isArchived: data.is_archived as boolean || false,
      isPinned: data.is_pinned as boolean || false,
      isMuted: userParticipant?.muted_until
        ? new Date(userParticipant.muted_until as string) > new Date()
        : false,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  private static mapMessageFromDB(data: Record<string, unknown>): Message {
    return {
      id: data.id as string,
      conversationId: data.conversation_id as string,
      senderId: data.sender_id as string,
      senderName: data.sender_name as string | undefined,
      senderAvatar: data.sender_avatar as string | undefined,
      senderType: data.sender_type as Message['senderType'] || 'user',
      type: data.type as MessageType,
      content: data.content as string,
      contentHtml: data.content_html as string | undefined,
      attachments: data.attachments as MessageAttachment[] | undefined,
      replyToId: data.reply_to_id as string | undefined,
      replyTo: data.reply_to ? {
        id: (data.reply_to as Record<string, unknown>).id as string,
        senderId: (data.reply_to as Record<string, unknown>).sender_id as string,
        senderName: ((data.reply_to as Record<string, unknown>).users as Record<string, unknown>)?.full_name as string || 'Inconnu',
        content: (data.reply_to as Record<string, unknown>).content as string,
        type: (data.reply_to as Record<string, unknown>).type as MessageType,
        createdAt: new Date((data.reply_to as Record<string, unknown>).created_at as string),
      } : undefined,
      mentions: data.mentions as Message['mentions'],
      metadata: data.metadata as MessageMetadata | undefined,
      reactions: data.reactions as Message['reactions'],
      status: data.status as MessageStatus,
      editedAt: data.edited_at ? new Date(data.edited_at as string) : undefined,
      deletedAt: data.deleted_at ? new Date(data.deleted_at as string) : undefined,
      readBy: data.read_by as Message['readBy'],
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }

  /**
   * Crée une conversation projet automatiquement
   */
  static async createProjectConversation(
    projectId: string,
    contractId: string,
    clientId: string,
    entrepriseId: string,
    projectTitle: string
  ): Promise<Conversation | null> {
    const result = await this.createConversation(
      {
        type: 'project',
        projectId,
        contractId,
        titre: `Projet: ${projectTitle}`,
        participantIds: [clientId],
        initialMessage: `Bienvenue dans l'espace de discussion du projet "${projectTitle}". Vous pouvez échanger ici avec l'entreprise tout au long du chantier.`,
      },
      entrepriseId
    );

    return result.conversation || null;
  }
}

export default MessagingService;
