/**
 * ConversationList - Liste des conversations
 * Affichage des conversations avec aperçu et indicateurs
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagingService } from '@/services/messaging/messaging.service';
import type { Conversation, ConversationType, PresenceStatus } from '@/types/messaging.types';
import {
  MessageSquare,
  Search,
  Plus,
  Users,
  Building2,
  FileText,
  Gavel,
  Milestone,
  Headphones,
  Pin,
  BellOff,
  Archive,
  Circle,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';

interface ConversationListProps {
  userId: string;
  selectedConversationId?: string;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation?: () => void;
}

export function ConversationList({
  userId,
  selectedConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    loadConversations();
  }, [userId]);

  const loadConversations = async () => {
    setLoading(true);
    const result = await MessagingService.getConversations(userId);
    if (result.conversations) {
      setConversations(result.conversations);
    }
    setLoading(false);
  };

  const getTypeIcon = (type: ConversationType) => {
    switch (type) {
      case 'project': return <FileText className="h-4 w-4" />;
      case 'direct': return <MessageSquare className="h-4 w-4" />;
      case 'group': return <Users className="h-4 w-4" />;
      case 'support': return <Headphones className="h-4 w-4" />;
      case 'milestone': return <Milestone className="h-4 w-4" />;
      case 'dispute': return <Gavel className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPresenceColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatLastMessageTime = (date?: Date) => {
    if (!date) return '';

    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Maintenant';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;

    return messageDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getInitials = (title?: string) => {
    if (!title) return '??';
    return title
      .split(' ')
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.title?.toLowerCase().includes(query) ||
      conv.lastMessagePreview?.toLowerCase().includes(query)
    );
  });

  // Trier: pinned d'abord, puis par date du dernier message
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    // Pinned en premier
    const aPinned = a.participants?.find(p => p.userId === userId)?.isPinned || false;
    const bPinned = b.participants?.find(p => p.userId === userId)?.isPinned || false;
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // Puis par date
    const aDate = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bDate = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bDate - aDate;
  });

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          {onNewConversation && (
            <Button size="sm" variant="ghost" onClick={onNewConversation}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="pt-0">
          {sortedConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucune conversation</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedConversations.map((conversation) => {
                const myParticipant = conversation.participants?.find(p => p.userId === userId);
                const unreadCount = myParticipant?.unreadCount || 0;
                const isPinned = myParticipant?.isPinned || false;
                const isMuted = myParticipant?.isMuted || false;
                const isSelected = conversation.id === selectedConversationId;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conversation.avatarUrl} />
                        <AvatarFallback className="text-xs">
                          {getInitials(conversation.title)}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.type === 'direct' && (
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                          getPresenceColor(presenceMap[conversation.id])
                        }`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isPinned && (
                            <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={`font-medium truncate ${
                            unreadCount > 0 ? 'text-foreground' : 'text-foreground'
                          }`}>
                            {conversation.title || 'Sans titre'}
                          </span>
                          {isMuted && (
                            <BellOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatLastMessageTime(conversation.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className={`text-sm truncate ${
                          unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                        }`}>
                          {conversation.lastMessagePreview || 'Aucun message'}
                        </p>
                        {unreadCount > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-xs">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Badge>
                        )}
                      </div>

                      {/* Type indicator */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-muted-foreground">
                          {getTypeIcon(conversation.type)}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {conversation.type === 'project' ? 'Projet' :
                           conversation.type === 'direct' ? 'Direct' :
                           conversation.type === 'group' ? 'Groupe' :
                           conversation.type === 'support' ? 'Support' :
                           conversation.type === 'milestone' ? 'Jalon' :
                           conversation.type === 'dispute' ? 'Litige' : conversation.type}
                        </span>
                        {conversation.messageCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            • {conversation.messageCount} msg
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </ScrollArea>

      {/* Stats en bas */}
      <div className="p-3 border-t flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{conversations.length} conversation(s)</span>
          <span>
            {conversations.reduce((sum, c) => {
              const p = c.participants?.find(p => p.userId === userId);
              return sum + (p?.unreadCount || 0);
            }, 0)} non lu(s)
          </span>
        </div>
      </div>
    </Card>
  );
}
