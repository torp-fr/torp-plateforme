/**
 * FeedbackWidget Component
 * Widget flottant pour collecter les retours utilisateurs
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, X, Send, Star, Bug, Lightbulb, ThumbsUp } from 'lucide-react';
import { feedbackService, type FeedbackType, type UserType } from '@/services/feedback/feedbackService';
import { useToast } from '@/hooks/use-toast';

interface FeedbackWidgetProps {
  userType: UserType;
  className?: string;
}

export function FeedbackWidget({ userType, className = '' }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('other');
  const [message, setMessage] = useState('');
  const [satisfactionScore, setSatisfactionScore] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message requis',
        description: 'Veuillez entrer votre feedback',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const result = await feedbackService.submitFeedback(
      {
        feedback_type: feedbackType,
        message: message.trim(),
        satisfaction_score: satisfactionScore > 0 ? satisfactionScore : undefined,
      },
      userType
    );

    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: '✅ Merci pour votre feedback !',
        description: 'Votre retour a été enregistré avec succès.',
      });

      // Reset form
      setMessage('');
      setSatisfactionScore(0);
      setFeedbackType('other');
      setIsOpen(false);
    } else {
      toast({
        title: '❌ Erreur',
        description: result.error || 'Impossible d\'envoyer le feedback',
        variant: 'destructive',
      });
    }
  };

  const feedbackTypes: { value: FeedbackType; label: string; icon: any; color: string }[] = [
    { value: 'bug', label: '🐛 Bug', icon: Bug, color: 'text-red-600' },
    { value: 'feature_request', label: '💡 Suggestion', icon: Lightbulb, color: 'text-yellow-600' },
    { value: 'improvement', label: '⚡ Amélioration', icon: Star, color: 'text-blue-600' },
    { value: 'praise', label: '👍 Compliment', icon: ThumbsUp, color: 'text-green-600' },
    { value: 'other', label: '💬 Autre', icon: MessageSquare, color: 'text-gray-600' },
  ];

  if (!isOpen) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <MessageSquare className="mr-2 h-5 w-5" />
          Feedback
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <Card className="w-96 shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Votre Feedback</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Aidez-nous à améliorer TORP 🎉
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Type de feedback */}
          <div className="space-y-2">
            <Label>Type de feedback</Label>
            <Select
              value={feedbackType}
              onValueChange={(value) => setFeedbackType(value as FeedbackType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {feedbackTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className={type.color}>{type.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Score de satisfaction */}
          <div className="space-y-2">
            <Label>Satisfaction (optionnel)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setSatisfactionScore(score)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 ${
                      score <= satisfactionScore
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Votre message *</Label>
            <Textarea
              placeholder="Partagez votre expérience, signalez un bug, ou suggérez une amélioration..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} / 500 caractères
            </p>
          </div>

          {/* Badge testeur */}
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="bg-green-600">
                🎉 Testeur
              </Badge>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Merci de votre participation !
              </span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Vos retours sont précieux pour améliorer TORP.
            </p>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className="flex-1"
          >
            {isSubmitting ? (
              <>Envoi...</>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Envoyer
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
