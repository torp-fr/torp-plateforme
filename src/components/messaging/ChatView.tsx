/**
 * ChatView - Vue de chat principale
 * Affichage des messages avec support temps réel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageInput } from './MessageInput';
import { MessagingService } from '@/services/messaging/messaging.service';
import type { Conversation, Message, MessageType, TypingIndicator } from '@/types/messaging.types';
import {
  MoreVertical,
  Phone,
  Video,
  Info,
  Pin,
  BellOff,
  Bell,
  Archive,
  Trash2,
  Users,
  FileText,
  Image,
  File,
  Download,
  Reply,
  Copy,
  Forward,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  MessageSquare
} from 'lucide-react';

interface ChatViewProps {
  conversation: Conversation;
  userId: string;
  onBack?: () => void;
}

export function ChatView({ conversation, userId, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const unsubscribe = subscribeToUpdates();

    return () => {
      unsubscribe();
    };
  }, [conversation.id]);

  useEffect(() => {
    // Auto-scroll quand nouveaux messages
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    const result = await MessagingService.getMessages(conversation.id);
    if (result.messages) {
      setMessages(result.messages);
    }
    setLoading(false);
  };

  const subscribeToUpdates = () => {
    return MessagingService.subscribeToConversation(conversation.id, {
      onNewMessage: (message) => {
        setMessages(prev => [...prev, message]);

        // Marquer comme lu si c'est pas mon message
        if (message.senderId !== userId) {
          MessagingService.markAsRead(conversation.id, message.id, userId);
        }
      },
      onTyping: (typing) => {
        setTypingUsers(prev => {
          const filtered = prev.filter(t => t.userId !== typing.userId);
          if (typing.isTyping) {
            return [...filtered, typing];
          }
          return filtered;
        });
      },
      onMessageRead: (read) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === read.messageId
              ? { ...msg, readBy: [...(msg.readBy || []), read.userId] }
              : msg
          )
        );
      }
    });
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const handleSendMessage = async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    setSending(true);

    // Extraire les mentions du contenu
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: { userId: string; displayName: string }[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push({
        displayName: match[1],
        userId: match[2]
      });
    }

    const result = await MessagingService.sendMessage({
      conversationId: conversation.id,
      content: content.replace(mentionRegex, '@$1'), // Clean content
      type: attachments && attachments.length > 0 ? 'file' : 'text',
      parentMessageId: replyTo?.id,
      mentions: mentions.length > 0 ? mentions : undefined
    }, userId);

    setSending(false);
    setReplyTo(null);

    if (result.error) {
      console.error('Error sending message:', result.error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await MessagingService.addReaction(messageId, emoji, userId);

    // Update local state
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id !== messageId) return msg;

        const reactions = { ...msg.reactions };
        if (!reactions[emoji]) {
          reactions[emoji] = [];
        }

        const userIndex = reactions[emoji].indexOf(userId);
        if (userIndex >= 0) {
          reactions[emoji] = reactions[emoji].filter(id => id !== userId);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        } else {
          reactions[emoji] = [...reactions[emoji], userId];
        }

        return { ...msg, reactions };
      })
    );
  };

  const getMessageTypeIcon = (type: MessageType) => {
    switch (type) {
      case 'file': return <File className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'document_share': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  const formatMessageTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateSeparator = (date: Date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Hier';
    } else {
      return messageDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;

    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const myParticipant = conversation.participants?.find(p => p.userId === userId);

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
              <div className="flex gap-2 max-w-[70%]">
                {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                <Skeleton className="h-16 w-48 rounded-lg" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="md:hidden">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
            )}
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.avatarUrl} />
              <AvatarFallback>{getInitials(conversation.title)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{conversation.title || 'Sans titre'}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {conversation.participants?.length || 0} participant(s)
                {typingUsers.length > 0 && (
                  <span className="text-primary ml-2">
                    {typingUsers.map(t => t.displayName || 'Quelqu\'un').join(', ')} écrit...
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Appel audio</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Video className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Appel vidéo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Informations</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Pin className="h-4 w-4 mr-2" />
                  {myParticipant?.isPinned ? 'Retirer l\'épingle' : 'Épingler'}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  {myParticipant?.isMuted ? (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Réactiver les notifications
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      Mettre en sourdine
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Voir les participants
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Quitter la conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
        ref={scrollAreaRef}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun message</p>
            <p className="text-sm">Commencez la conversation !</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.senderId === userId;
            const prevMessage = messages[index - 1];
            const showDateSeparator = shouldShowDateSeparator(message, prevMessage);
            const showAvatar = !isOwn && (
              !prevMessage ||
              prevMessage.senderId !== message.senderId ||
              showDateSeparator
            );

            return (
              <div key={message.id}>
                {/* Séparateur de date */}
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {formatDateSeparator(message.createdAt)}
                    </div>
                  </div>
                )}

                {/* Message système */}
                {message.isSystemMessage ? (
                  <div className="flex justify-center my-2">
                    <div className="bg-muted/50 px-3 py-1.5 rounded-full text-xs text-muted-foreground">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      {!isOwn && (
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(message.senderName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}

                      <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                        {/* Nom de l'expéditeur */}
                        {!isOwn && showAvatar && (
                          <p className="text-xs text-muted-foreground ml-1">
                            {message.senderName || 'Inconnu'}
                          </p>
                        )}

                        {/* Réponse à */}
                        {message.parentMessageId && (
                          <div className={`text-xs p-2 rounded bg-muted/50 border-l-2 ${
                            isOwn ? 'border-primary/50' : 'border-muted-foreground/30'
                          }`}>
                            <p className="text-muted-foreground truncate">
                              En réponse à un message
                            </p>
                          </div>
                        )}

                        {/* Bulle de message */}
                        <div
                          className={`relative px-3 py-2 rounded-2xl ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          }`}
                        >
                          {/* Pièces jointes */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {message.attachments.map((attachment, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded bg-background/20">
                                  {attachment.type?.startsWith('image') ? (
                                    <Image className="h-4 w-4" />
                                  ) : (
                                    <File className="h-4 w-4" />
                                  )}
                                  <span className="text-sm truncate flex-1">
                                    {attachment.name}
                                  </span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Contenu */}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>

                          {/* Heure et statut */}
                          <div className={`flex items-center gap-1 mt-1 ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}>
                            <span className={`text-[10px] ${
                              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {formatMessageTime(message.createdAt)}
                              {message.isEdited && ' (modifié)'}
                            </span>
                            {isOwn && (
                              <span className="text-primary-foreground/70">
                                {message.readBy && message.readBy.length > 0 ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Réactions */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(message.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(message.id, emoji)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                  users.includes(userId)
                                    ? 'bg-primary/20 border border-primary/30'
                                    : 'bg-muted border border-transparent'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-muted-foreground">{users.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Menu contextuel */}
                      <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                        isOwn ? 'order-first' : ''
                      }`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isOwn ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => setReplyTo(message)}>
                              <Reply className="h-4 w-4 mr-2" />
                              Répondre
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Copier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Forward className="h-4 w-4 mr-2" />
                              Transférer
                            </DropdownMenuItem>
                            {isOwn && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Indicateur de frappe */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].displayName || 'Quelqu\'un'} écrit...`
                : `${typingUsers.length} personnes écrivent...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bouton scroll vers le bas */}
      {showScrollButton && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-24 right-8 rounded-full shadow-lg"
          onClick={() => scrollToBottom()}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      {/* Zone de réponse */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/50 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm">
              <span className="text-muted-foreground">Réponse à </span>
              <span className="font-medium">{replyTo.senderName}</span>
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                {replyTo.content}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t flex-shrink-0">
        <MessageInput
          conversationId={conversation.id}
          userId={userId}
          onSend={handleSendMessage}
          sending={sending}
          participants={conversation.participants}
        />
      </div>
    </Card>
  );
}
