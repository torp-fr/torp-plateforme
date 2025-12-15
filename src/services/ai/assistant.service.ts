/**
 * AI Assistant Service
 * Service d'assistant conversationnel IA pour TORP
 * Utilise Claude pour répondre aux questions des utilisateurs
 */

import { claudeService } from './claude.service';
import { supabase } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AssistantContext {
  userId?: string;
  projectId?: string;
  analysisId?: string;
  userProfile?: {
    type: 'B2C' | 'B2B';
    name: string;
  };
  projectInfo?: {
    name: string;
    type: string;
    budget?: number;
    status?: string;
  };
  analysisInfo?: {
    grade: string;
    score: number;
    entrepriseName: string;
    montant: number;
  };
}

export interface AssistantResponse {
  success: boolean;
  message: string;
  suggestions?: string[];
  actions?: {
    type: 'navigate' | 'action' | 'info';
    label: string;
    target: string;
  }[];
  error?: string;
}

export type AssistantDomain =
  | 'general'
  | 'quote_analysis'
  | 'comparison'
  | 'negotiation'
  | 'planning'
  | 'payment'
  | 'legal'
  | 'technical';

// =====================================================
// SYSTEM PROMPTS
// =====================================================

const SYSTEM_PROMPTS: Record<AssistantDomain, string> = {
  general: `Tu es TORP Assistant, l'assistant IA de la plateforme TORP (Trusted Quote Review Platform).
TORP aide les particuliers (B2C) à analyser leurs devis de travaux et les professionnels (B2B) à optimiser leurs propositions.

Tu dois :
- Être amical, professionnel et concis
- Répondre en français
- Donner des conseils pratiques et actionnables
- Toujours rappeler que tu n'es pas un conseiller juridique pour les questions complexes
- Suggérer des actions concrètes quand c'est pertinent

Tu connais les fonctionnalités de TORP :
- Analyse de devis avec scoring (A+ à F)
- Comparaison de plusieurs devis
- Vérification des entreprises (SIRET, assurances)
- Suivi de projet et planning
- Paiement sécurisé par jalons
- Génération de contrats`,

  quote_analysis: `Tu es un expert en analyse de devis de travaux BTP pour TORP.
Tu aides les utilisateurs à comprendre leurs devis et à identifier :
- Les points forts et faibles
- Les risques potentiels
- Les éléments manquants
- Les prix par rapport au marché
- Les clauses importantes

Sois précis dans tes explications et donne des exemples concrets.
Si l'utilisateur partage des détails de son devis, analyse-les en profondeur.`,

  comparison: `Tu es un expert en comparaison de devis pour TORP.
Tu aides les utilisateurs à comparer plusieurs devis et à choisir le meilleur.

Critères à considérer :
- Prix global et cohérence
- Qualité des entreprises (ancienneté, avis, certifications)
- Complétude du devis
- Garanties proposées
- Délais de réalisation
- Conditions de paiement

Guide l'utilisateur vers une décision éclairée.`,

  negotiation: `Tu es un expert en négociation de devis BTP pour TORP.
Tu aides les utilisateurs à négocier efficacement avec les artisans.

Conseils de négociation :
- Identifier les postes négociables
- Préparer ses arguments
- Comparer avec les prix du marché
- Proposer des alternatives (matériaux, planning)
- Rester courtois et professionnel

Donne des exemples de phrases de négociation concrètes.`,

  planning: `Tu es un expert en planification de chantier pour TORP.
Tu aides les utilisateurs à organiser leurs travaux.

Sujets couverts :
- Ordonnancement des tâches (méthode PERT)
- Gestion des dépendances
- Identification du chemin critique
- Anticipation des retards
- Coordination des intervenants
- Réunions de chantier

Fournis des conseils pratiques et réalistes.`,

  payment: `Tu es un expert en gestion des paiements de travaux pour TORP.
Tu conseilles les utilisateurs sur :

- Échéanciers de paiement recommandés
- Acompte raisonnable (max 30%)
- Paiements par jalons
- Protection contre les impayés
- Gestion des litiges
- Retenue de garantie

Important : Toujours recommander de ne pas payer l'intégralité avant la fin des travaux.`,

  legal: `Tu es un conseiller en aspects juridiques des travaux BTP pour TORP.
Tu informes sur :

- Devis obligatoires et mentions légales
- Délai de rétractation (14 jours)
- Garanties légales (décennale, biennale, parfait achèvement)
- Assurances obligatoires
- Réclamations et litiges
- Réception des travaux

IMPORTANT : Tu n'es pas avocat. Pour les cas complexes, recommande toujours de consulter un professionnel du droit.`,

  technical: `Tu es un expert technique en travaux BTP pour TORP.
Tu expliques les aspects techniques des travaux :

- Matériaux et leurs caractéristiques
- Normes et réglementations (DTU, NF)
- Techniques de mise en œuvre
- Durabilité et entretien
- Alternatives écologiques
- Ordre logique des interventions

Vulgarise les termes techniques pour que tout le monde comprenne.`,
};

// =====================================================
// SERVICE
// =====================================================

class AIAssistantService {
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();
  private maxHistoryLength = 20;

  /**
   * Vérifie si le service est configuré
   */
  isConfigured(): boolean {
    return claudeService.isConfigured();
  }

  /**
   * Envoie un message à l'assistant et obtient une réponse
   */
  async chat(
    message: string,
    options: {
      sessionId: string;
      domain?: AssistantDomain;
      context?: AssistantContext;
      streaming?: boolean;
      onStream?: (chunk: string) => void;
    }
  ): Promise<AssistantResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: '',
        error: 'Service IA non configuré. Veuillez configurer la clé API Anthropic.',
      };
    }

    try {
      // Récupérer ou initialiser l'historique
      let history = this.conversationHistory.get(options.sessionId) || [];

      // Ajouter le message utilisateur
      history.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      // Construire le contexte enrichi
      const contextInfo = this.buildContextInfo(options.context);
      const systemPrompt = this.buildSystemPrompt(options.domain || 'general', contextInfo);

      // Construire les messages pour Claude
      const messages = history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Appeler Claude
      let response: string;

      if (options.streaming && options.onStream) {
        response = await claudeService.streamChat(
          messages,
          {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 2000,
          },
          options.onStream
        );
      } else {
        response = await claudeService.chat(messages, {
          systemPrompt,
          temperature: 0.7,
          maxTokens: 2000,
        });
      }

      // Ajouter la réponse à l'historique
      history.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      // Limiter la taille de l'historique
      if (history.length > this.maxHistoryLength) {
        history = history.slice(-this.maxHistoryLength);
      }

      this.conversationHistory.set(options.sessionId, history);

      // Sauvegarder en base si userId fourni
      if (options.context?.userId) {
        await this.saveConversation(options.sessionId, options.context.userId, history);
      }

      // Parser les suggestions de la réponse
      const suggestions = this.extractSuggestions(response, options.domain);
      const actions = this.extractActions(response, options.domain);

      return {
        success: true,
        message: response,
        suggestions,
        actions,
      };

    } catch (error) {
      console.error('[AIAssistant] Erreur:', error);
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Erreur inattendue',
      };
    }
  }

  /**
   * Obtient une réponse rapide sans historique
   */
  async quickAnswer(
    question: string,
    domain: AssistantDomain = 'general',
    context?: AssistantContext
  ): Promise<string> {
    if (!this.isConfigured()) {
      return 'Je suis désolé, le service IA n\'est pas disponible actuellement.';
    }

    try {
      const contextInfo = this.buildContextInfo(context);
      const systemPrompt = this.buildSystemPrompt(domain, contextInfo);

      const response = await claudeService.chat(
        [{ role: 'user', content: question }],
        {
          systemPrompt,
          temperature: 0.5,
          maxTokens: 1000,
        }
      );

      return response;
    } catch (error) {
      console.error('[AIAssistant] Erreur quickAnswer:', error);
      return 'Je suis désolé, je n\'ai pas pu traiter votre demande. Veuillez réessayer.';
    }
  }

  /**
   * Analyse une question et détermine le domaine approprié
   */
  async detectDomain(question: string): Promise<AssistantDomain> {
    const lowerQuestion = question.toLowerCase();

    // Détection par mots-clés
    if (lowerQuestion.match(/compar|versus|meilleur|choisir entre/)) {
      return 'comparison';
    }
    if (lowerQuestion.match(/négoci|réduire|baisser|trop cher|prix/)) {
      return 'negotiation';
    }
    if (lowerQuestion.match(/planning|planning|délai|calendrier|date|quand/)) {
      return 'planning';
    }
    if (lowerQuestion.match(/pay|acompte|échéance|virement|facture/)) {
      return 'payment';
    }
    if (lowerQuestion.match(/juridique|loi|droit|garantie|assurance|recours|litige/)) {
      return 'legal';
    }
    if (lowerQuestion.match(/technique|matériau|norme|dtu|réaliser|installer|poser/)) {
      return 'technical';
    }
    if (lowerQuestion.match(/devis|analyse|score|grade|entreprise/)) {
      return 'quote_analysis';
    }

    return 'general';
  }

  /**
   * Génère des suggestions de questions
   */
  async getSuggestions(
    context?: AssistantContext,
    domain?: AssistantDomain
  ): Promise<string[]> {
    const baseSuggestions: Record<AssistantDomain, string[]> = {
      general: [
        'Comment fonctionne le scoring TORP ?',
        'Quels documents demander à un artisan ?',
        'Comment vérifier une entreprise ?',
      ],
      quote_analysis: [
        'Ce prix est-il correct pour ce type de travaux ?',
        'Quels éléments manquent dans ce devis ?',
        'Que signifie cette mention dans mon devis ?',
      ],
      comparison: [
        'Quel devis me recommandez-vous ?',
        'Pourquoi ce devis est-il moins cher ?',
        'Comment interpréter les écarts de prix ?',
      ],
      negotiation: [
        'Comment négocier ce devis ?',
        'Quels postes sont négociables ?',
        'Comment demander une remise ?',
      ],
      planning: [
        'Combien de temps durent ces travaux ?',
        'Dans quel ordre réaliser les travaux ?',
        'Comment gérer un retard de chantier ?',
      ],
      payment: [
        'Quel acompte est raisonnable ?',
        'Quand payer le solde ?',
        'Comment sécuriser mes paiements ?',
      ],
      legal: [
        'Quelles garanties sont obligatoires ?',
        'Ai-je un délai de rétractation ?',
        'Que faire en cas de malfaçon ?',
      ],
      technical: [
        'Quel matériau choisir ?',
        'Cette technique est-elle adaptée ?',
        'Quelles normes s\'appliquent ?',
      ],
    };

    // Suggestions contextuelles
    if (context?.analysisInfo) {
      return [
        `Que pensez-vous du score ${context.analysisInfo.grade} ?`,
        `Le prix de ${context.analysisInfo.montant.toLocaleString('fr-FR')}€ est-il correct ?`,
        'Quels points négocier avec cette entreprise ?',
      ];
    }

    return baseSuggestions[domain || 'general'];
  }

  /**
   * Réinitialise l'historique d'une session
   */
  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Récupère l'historique d'une session
   */
  getHistory(sessionId: string): ConversationMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private buildContextInfo(context?: AssistantContext): string {
    if (!context) return '';

    const parts: string[] = [];

    if (context.userProfile) {
      parts.push(`Utilisateur: ${context.userProfile.name} (${context.userProfile.type})`);
    }

    if (context.projectInfo) {
      parts.push(`Projet: "${context.projectInfo.name}" - ${context.projectInfo.type}`);
      if (context.projectInfo.budget) {
        parts.push(`Budget estimé: ${context.projectInfo.budget.toLocaleString('fr-FR')}€`);
      }
      if (context.projectInfo.status) {
        parts.push(`Statut: ${context.projectInfo.status}`);
      }
    }

    if (context.analysisInfo) {
      parts.push(`Analyse en cours: Devis de ${context.analysisInfo.entrepriseName}`);
      parts.push(`Montant: ${context.analysisInfo.montant.toLocaleString('fr-FR')}€`);
      parts.push(`Score TORP: ${context.analysisInfo.score}/1000 (${context.analysisInfo.grade})`);
    }

    return parts.length > 0
      ? `\n\nCONTEXTE UTILISATEUR:\n${parts.join('\n')}`
      : '';
  }

  private buildSystemPrompt(domain: AssistantDomain, contextInfo: string): string {
    return SYSTEM_PROMPTS[domain] + contextInfo;
  }

  private extractSuggestions(response: string, domain?: AssistantDomain): string[] {
    // Extraire les suggestions si mentionnées dans la réponse
    // ou générer des suggestions par défaut
    const suggestions: string[] = [];

    // Chercher des questions suggérées dans la réponse
    const questionMatch = response.match(/(?:voulez-vous|souhaitez-vous|puis-je|avez-vous)[^?]+\?/gi);
    if (questionMatch) {
      suggestions.push(...questionMatch.slice(0, 3));
    }

    return suggestions;
  }

  private extractActions(response: string, domain?: AssistantDomain): AssistantResponse['actions'] {
    const actions: NonNullable<AssistantResponse['actions']> = [];

    // Détecter les actions suggérées dans la réponse
    if (response.match(/comparer|comparaison/i)) {
      actions.push({
        type: 'navigate',
        label: 'Comparer mes devis',
        target: '/comparison',
      });
    }

    if (response.match(/analyse|analyser/i) && domain !== 'quote_analysis') {
      actions.push({
        type: 'navigate',
        label: 'Analyser un devis',
        target: '/analyze',
      });
    }

    if (response.match(/contact|joindre|appeler/i)) {
      actions.push({
        type: 'action',
        label: 'Contacter le support',
        target: 'support',
      });
    }

    return actions.length > 0 ? actions : undefined;
  }

  private async saveConversation(
    sessionId: string,
    userId: string,
    history: ConversationMessage[]
  ): Promise<void> {
    try {
      await supabase
        .from('ai_conversations')
        .upsert({
          session_id: sessionId,
          user_id: userId,
          messages: history,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'session_id',
        });
    } catch (error) {
      console.error('[AIAssistant] Erreur sauvegarde:', error);
    }
  }

  /**
   * Charge une conversation existante
   */
  async loadConversation(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('session_id', sessionId)
        .single();

      if (error || !data) return [];

      const messages = data.messages as ConversationMessage[];
      this.conversationHistory.set(sessionId, messages);
      return messages;
    } catch {
      return [];
    }
  }
}

export const aiAssistantService = new AIAssistantService();
export default aiAssistantService;
