/**
 * AIAssistant Component
 * Composant d'assistance IA contextuelle
 * Fournit des conseils, analyses et recommandations basés sur le contexte
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Send,
  Loader2,
  RefreshCw,
  BookOpen,
  Target,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface AIContext {
  phase: 'phase0' | 'phase1' | 'phase2';
  step?: string;
  userType: 'B2C' | 'B2B' | 'B2G';
  projectData?: Record<string, unknown>;
  currentPage?: string;
  formData?: Record<string, unknown>;
}

export interface AIInsight {
  type: 'tip' | 'warning' | 'success' | 'info' | 'action';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionCallback?: () => void;
}

export interface AIAssistantProps {
  context: AIContext;
  insights?: AIInsight[];
  onInsightAction?: (insight: AIInsight) => void;
  minimized?: boolean;
  position?: 'sidebar' | 'floating' | 'inline';
  showChat?: boolean;
}

// =============================================================================
// INSIGHT GENERATORS (Based on context)
// =============================================================================

function generatePhase1Insights(
  context: AIContext,
  step?: string
): AIInsight[] {
  const insights: AIInsight[] = [];
  const { userType, projectData } = context;

  // Insights pour l'étape DCE
  if (step === 'dce' || !step) {
    if (userType === 'B2C') {
      insights.push({
        type: 'tip',
        title: 'Conseil pour votre dossier',
        message: 'Vérifiez que vous avez bien défini tous les lots de travaux. Un dossier complet attire plus d\'artisans qualifiés.',
        priority: 'high',
      });
    }

    if (userType === 'B2G') {
      insights.push({
        type: 'warning',
        title: 'Obligation légale',
        message: 'Pour les marchés publics > 40 000€ HT, la publication sur une plateforme de dématérialisation est obligatoire.',
        priority: 'high',
      });
    }

    insights.push({
      type: 'info',
      title: 'Documents générés',
      message: 'Le DCE comprend : Règlement de Consultation, Acte d\'Engagement, DPGF et Cadre de Mémoire Technique. Chaque document a un rôle spécifique.',
      priority: 'medium',
    });
  }

  // Insights pour la recherche d'entreprises
  if (step === 'entreprises') {
    insights.push({
      type: 'tip',
      title: 'Qualifications RGE',
      message: 'Privilégiez les entreprises RGE pour vos travaux de rénovation énergétique. Cela peut vous ouvrir droit à des aides financières.',
      priority: 'high',
    });

    if (projectData?.selectedLots && (projectData.selectedLots as unknown[]).length > 2) {
      insights.push({
        type: 'info',
        title: 'Allotissement',
        message: `Votre projet comporte ${(projectData.selectedLots as unknown[]).length} lots. Vous pouvez consulter une entreprise générale ou des artisans spécialisés par lot.`,
        priority: 'medium',
      });
    }
  }

  // Insights pour l'analyse des offres
  if (step === 'offres') {
    insights.push({
      type: 'tip',
      title: 'Analyse des prix',
      message: 'Méfiez-vous des offres anormalement basses. Un prix trop bas peut cacher des prestations incomplètes ou des malfaçons futures.',
      priority: 'high',
    });

    insights.push({
      type: 'info',
      title: 'Critères d\'évaluation',
      message: 'Ne vous basez pas uniquement sur le prix. Évaluez aussi : qualifications, références, méthodologie, et garanties proposées.',
      priority: 'medium',
    });
  }

  // Insights pour le contrat
  if (step === 'contrat') {
    insights.push({
      type: 'warning',
      title: 'Points de vigilance',
      message: 'Vérifiez les clauses de pénalités de retard, les conditions de réception et les garanties (parfait achèvement, biennale, décennale).',
      priority: 'high',
    });

    insights.push({
      type: 'tip',
      title: 'Échéancier de paiement',
      message: 'Un échéancier équilibré : 20-30% à la commande, paiements intermédiaires sur avancement, solde de 5% à la réception.',
      priority: 'medium',
    });
  }

  return insights;
}

function generatePhase2Insights(
  context: AIContext,
  step?: string
): AIInsight[] {
  const insights: AIInsight[] = [];

  insights.push({
    type: 'tip',
    title: 'Préparation du chantier',
    message: 'Avant le démarrage, assurez-vous d\'avoir : l\'ordre de service, le planning validé, et toutes les autorisations nécessaires.',
    priority: 'high',
  });

  if (step === 'planning') {
    insights.push({
      type: 'info',
      title: 'Chemin critique',
      message: 'Identifiez les tâches critiques qui impactent directement la date de fin. Un retard sur ces tâches retardera tout le projet.',
      priority: 'high',
    });
  }

  if (step === 'reunions') {
    insights.push({
      type: 'tip',
      title: 'Réunions de chantier',
      message: 'Documentez systématiquement les décisions prises. Le compte-rendu fait foi en cas de litige.',
      priority: 'medium',
    });
  }

  return insights;
}

function generateContextualInsights(context: AIContext): AIInsight[] {
  const { phase, step } = context;

  switch (phase) {
    case 'phase1':
      return generatePhase1Insights(context, step);
    case 'phase2':
      return generatePhase2Insights(context, step);
    default:
      return [];
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AIAssistant({
  context,
  insights: propInsights,
  onInsightAction,
  minimized = false,
  position = 'sidebar',
  showChat = true,
}: AIAssistantProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(!minimized);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  // Generate insights based on context
  useEffect(() => {
    if (propInsights) {
      setInsights(propInsights);
    } else {
      const generatedInsights = generateContextualInsights(context);
      setInsights(generatedInsights);
    }
  }, [context, propInsights]);

  // Handle chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Call AI edge function for contextual response
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: userMessage,
          context: {
            phase: context.phase,
            step: context.step,
            userType: context.userType,
            currentPage: context.currentPage,
          },
          history: chatHistory.slice(-6), // Last 6 messages for context
        },
      });

      if (error) throw error;

      const assistantResponse = data?.response || getLocalResponse(userMessage, context);
      setChatHistory(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
    } catch (err) {
      console.error('AI Assistant error:', err);
      // Fallback to local response
      const localResponse = getLocalResponse(userMessage, context);
      setChatHistory(prev => [...prev, { role: 'assistant', content: localResponse }]);
    } finally {
      setIsLoading(false);
    }
  }, [chatMessage, context, chatHistory]);

  const handleRefreshInsights = useCallback(() => {
    const newInsights = generateContextualInsights(context);
    setInsights(newInsights);
    toast({
      title: 'Conseils actualisés',
      description: `${newInsights.length} nouveau(x) conseil(s) disponible(s)`,
    });
  }, [context, toast]);

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'tip':
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'action':
        return <Zap className="w-4 h-4 text-blue-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getInsightBgColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'tip':
        return 'bg-amber-50 border-amber-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'action':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Render based on position
  if (position === 'floating') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              className="rounded-full w-14 h-14 shadow-lg"
              variant={isExpanded ? 'secondary' : 'default'}
            >
              <Sparkles className="w-6 h-6" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="w-80 mt-2 shadow-xl">
              <AIAssistantContent
                insights={insights}
                chatHistory={chatHistory}
                chatMessage={chatMessage}
                setChatMessage={setChatMessage}
                handleSendMessage={handleSendMessage}
                handleRefreshInsights={handleRefreshInsights}
                isLoading={isLoading}
                showChat={showChat}
                onInsightAction={onInsightAction}
                getInsightIcon={getInsightIcon}
                getInsightBgColor={getInsightBgColor}
              />
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Sidebar or inline rendering
  return (
    <Card className={position === 'inline' ? 'w-full' : ''}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Assistant TORP
              </CardTitle>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <AIAssistantContent
            insights={insights}
            chatHistory={chatHistory}
            chatMessage={chatMessage}
            setChatMessage={setChatMessage}
            handleSendMessage={handleSendMessage}
            handleRefreshInsights={handleRefreshInsights}
            isLoading={isLoading}
            showChat={showChat}
            onInsightAction={onInsightAction}
            getInsightIcon={getInsightIcon}
            getInsightBgColor={getInsightBgColor}
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// =============================================================================
// ASSISTANT CONTENT
// =============================================================================

interface AIAssistantContentProps {
  insights: AIInsight[];
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  chatMessage: string;
  setChatMessage: (msg: string) => void;
  handleSendMessage: () => void;
  handleRefreshInsights: () => void;
  isLoading: boolean;
  showChat: boolean;
  onInsightAction?: (insight: AIInsight) => void;
  getInsightIcon: (type: AIInsight['type']) => React.ReactNode;
  getInsightBgColor: (type: AIInsight['type']) => string;
}

function AIAssistantContent({
  insights,
  chatHistory,
  chatMessage,
  setChatMessage,
  handleSendMessage,
  handleRefreshInsights,
  isLoading,
  showChat,
  onInsightAction,
  getInsightIcon,
  getInsightBgColor,
}: AIAssistantContentProps) {
  return (
    <CardContent className="space-y-4">
      {/* Insights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Conseils contextuels
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshInsights}
            className="h-8"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Actualiser
          </Button>
        </div>

        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {insights.length > 0 ? (
              insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getInsightBgColor(insight.type)}`}
                >
                  <div className="flex items-start gap-2">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {insight.title}
                        </span>
                        {insight.priority === 'high' && (
                          <Badge variant="destructive" className="text-xs">
                            Important
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insight.message}
                      </p>
                      {insight.actionLabel && (
                        <Button
                          variant="link"
                          size="sm"
                          className="px-0 h-auto mt-2"
                          onClick={() => onInsightAction?.(insight)}
                        >
                          {insight.actionLabel} →
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Aucun conseil pour le moment
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat */}
      {showChat && (
        <div className="space-y-3 pt-3 border-t">
          <span className="text-sm font-medium text-muted-foreground">
            Posez une question
          </span>

          {/* Chat history */}
          {chatHistory.length > 0 && (
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-2">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary/10 ml-4'
                        : 'bg-muted mr-4'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Ex: Quels documents dois-je vérifier ?"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={isLoading || !chatMessage.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <BookOpen className="w-3 h-3 mr-1" />
          Guide
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <Target className="w-3 h-3 mr-1" />
          Objectifs
        </Badge>
        <Badge variant="outline" className="cursor-pointer hover:bg-muted">
          <TrendingUp className="w-3 h-3 mr-1" />
          Progression
        </Badge>
      </div>
    </CardContent>
  );
}

// =============================================================================
// LOCAL RESPONSE FALLBACK
// =============================================================================

function getLocalResponse(message: string, context: AIContext): string {
  const lowerMsg = message.toLowerCase();

  // DCE related questions
  if (lowerMsg.includes('dce') || lowerMsg.includes('document')) {
    return 'Le DCE (Dossier de Consultation des Entreprises) comprend le Règlement de Consultation, l\'Acte d\'Engagement, le DPGF et le Cadre de Mémoire Technique. Chaque document a un rôle spécifique dans la consultation.';
  }

  // Price related
  if (lowerMsg.includes('prix') || lowerMsg.includes('budget') || lowerMsg.includes('devis')) {
    return 'Pour évaluer les prix, comparez toujours plusieurs offres. Un prix anormalement bas peut cacher des prestations incomplètes. Vérifiez que tous les postes sont bien chiffrés.';
  }

  // Entreprise / artisan related
  if (lowerMsg.includes('artisan') || lowerMsg.includes('entreprise') || lowerMsg.includes('rge')) {
    return 'Privilégiez les entreprises qualifiées RGE pour les travaux de rénovation énergétique. Vérifiez leurs assurances (décennale, RC Pro) et demandez des références de chantiers similaires.';
  }

  // Contrat related
  if (lowerMsg.includes('contrat') || lowerMsg.includes('signature')) {
    return 'Avant de signer, vérifiez : le détail des prestations, les délais d\'exécution, les pénalités de retard, les conditions de paiement, et les garanties (parfait achèvement, biennale, décennale).';
  }

  // Default
  return 'Je suis là pour vous aider dans votre projet de travaux. N\'hésitez pas à me poser des questions sur les documents, les entreprises, les prix ou les démarches à suivre.';
}

export default AIAssistant;
