/**
 * MessageInput - Zone de saisie de message
 * Support pièces jointes, mentions, emojis
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MessagingService } from '@/services/messaging/messaging.service';
import type { Participant } from '@/types/messaging.types';
import {
  Send,
  Paperclip,
  Smile,
  Image,
  FileText,
  Camera,
  Mic,
  X,
  Loader2,
  AtSign,
  File
} from 'lucide-react';

interface MessageInputProps {
  conversationId: string;
  userId: string;
  onSend: (content: string, attachments?: File[]) => void;
  sending?: boolean;
  participants?: Participant[];
  placeholder?: string;
}

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '😊', '😂', '🎉', '🙏', '👏',
  '🔥', '✅', '❌', '⭐', '💯', '🚀', '💪', '🤔',
  '😮', '😢', '😡', '🤝', '👀', '📸', '📎', '📝'
];

export function MessageInput({
  conversationId,
  userId,
  onSend,
  sending = false,
  participants = [],
  placeholder = 'Écrivez un message...'
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Gérer l'indicateur de frappe
  useEffect(() => {
    if (content.length > 0 && !isTyping) {
      setIsTyping(true);
      MessagingService.setTyping(conversationId, userId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        MessagingService.setTyping(conversationId, userId, false);
      }
    }, 2000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [content, conversationId, userId, isTyping]);

  // Nettoyage à la fermeture
  useEffect(() => {
    return () => {
      MessagingService.setTyping(conversationId, userId, false);
    };
  }, [conversationId, userId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;

    setContent(value);

    // Détecter si on commence une mention
    const textBeforeCursor = value.substring(0, selectionStart);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1].toLowerCase());
      setMentionPosition(selectionStart - mentionMatch[0].length);
    } else {
      setShowMentions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Envoyer avec Enter (sans Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Fermer les mentions avec Escape
    if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  const handleSend = () => {
    if ((!content.trim() && attachments.length === 0) || sending) return;

    onSend(content.trim(), attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachments([]);
    setIsTyping(false);
    MessagingService.setTyping(conversationId, userId, false);

    // Focus sur le textarea
    textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
    // Reset input pour permettre de re-sélectionner le même fichier
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const insertMention = (participant: Participant) => {
    if (!textareaRef.current) return;

    const before = content.substring(0, mentionPosition);
    const after = content.substring(textareaRef.current.selectionStart);
    const mention = `@[${participant.displayName || participant.userId}](${participant.userId}) `;

    setContent(before + mention + after);
    setShowMentions(false);

    // Repositionner le curseur
    const newPosition = before.length + mention.length;
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
      textareaRef.current?.focus();
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const before = content.substring(0, start);
    const after = content.substring(end);

    setContent(before + emoji + after);

    // Repositionner le curseur
    setTimeout(() => {
      const newPosition = start + emoji.length;
      textareaRef.current?.setSelectionRange(newPosition, newPosition);
      textareaRef.current?.focus();
    }, 0);
  };

  const filteredParticipants = participants.filter(p => {
    if (p.userId === userId) return false;
    const query = mentionQuery.toLowerCase();
    return (
      p.displayName?.toLowerCase().includes(query) ||
      p.userId.toLowerCase().includes(query)
    );
  });

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Pièces jointes */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
          {attachments.map((file, index) => (
            <Badge key={index} variant="secondary" className="pr-1 gap-2">
              {getFileIcon(file)}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={() => removeAttachment(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Zone de saisie */}
      <div className="relative flex items-end gap-2">
        {/* Input fichier caché */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Boutons gauche */}
        <div className="flex items-center gap-1 mb-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Paperclip className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Document
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                      fileInputRef.current.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';
                    }
                  }}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Photo
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Camera className="h-4 w-4 mr-2" />
                  Prendre photo
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Textarea */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[40px] max-h-[120px] resize-none pr-20"
            rows={1}
            disabled={sending}
          />

          {/* Suggestions de mentions */}
          {showMentions && filteredParticipants.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
              <Command>
                <CommandList>
                  <CommandGroup heading="Mentionner">
                    {filteredParticipants.slice(0, 5).map((participant) => (
                      <CommandItem
                        key={participant.userId}
                        onSelect={() => insertMention(participant)}
                        className="cursor-pointer"
                      >
                        <AtSign className="h-4 w-4 mr-2" />
                        <span>{participant.displayName || participant.userId}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}

          {/* Boutons dans le textarea */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* Emojis */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-lg"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mention */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                const cursorPos = textareaRef.current?.selectionStart || content.length;
                const before = content.substring(0, cursorPos);
                const after = content.substring(cursorPos);
                setContent(before + '@' + after);
                setMentionPosition(cursorPos);
                setShowMentions(true);
                setMentionQuery('');
                setTimeout(() => {
                  textareaRef.current?.setSelectionRange(cursorPos + 1, cursorPos + 1);
                  textareaRef.current?.focus();
                }, 0);
              }}
            >
              <AtSign className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bouton envoyer */}
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || sending}
          size="icon"
          className="h-10 w-10 mb-0"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Indicateur de caractères */}
      {content.length > 500 && (
        <div className="text-xs text-right text-muted-foreground">
          {content.length} / 2000
        </div>
      )}
    </div>
  );
}
