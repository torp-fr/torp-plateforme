import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageCircle, Send, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ChatAIProps {
  projectId?: string;
  analysisResult?: any;
  context?: 'collectivite' | 'project';
}

const ChatAI: React.FC<ChatAIProps> = ({ projectId, analysisResult, context = 'collectivite' }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: context === 'collectivite' 
        ? "Bonjour ! Je suis votre assistant IA pour l'observatoire territorial. Comment puis-je vous aider à optimiser vos politiques publiques BTP ?"
        : "Bonjour ! Je suis votre assistant maître d'œuvre IA. Je peux vous accompagner dans la gestion complète de votre projet de travaux : planning, budget, qualité, coordination d'équipe... Comment puis-je vous aider ?",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const collectiviteQuestions = [
    "Quelles sont les tendances BTP sur mon territoire ?",
    "Comment optimiser les aides publiques ?",
    "Quels secteurs nécessitent une vigilance accrue ?",
    "Recommandations pour le plan d'urbanisme"
  ];

  const projectQuestions = [
    "Comment optimiser le planning de mon projet ?",
    "Quels sont les risques sur mon budget ?",
    "Conseils pour choisir les bons matériaux",
    "Comment contrôler la qualité des travaux ?"
  ];

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simuler une réponse IA
    setTimeout(() => {
      const aiResponse = generateAIResponse(message, context);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string, context: string): string => {
    const input = userInput.toLowerCase();
    
    if (context === 'project') {
      // Réponses spécialisées pour la gestion de projet avec expertise maître d'œuvre
      if (input.includes('phase') || input.includes('étape') || input.includes('planning')) {
        return "🏗️ **Expertise Maître d'Œuvre - Phases :**\n\nEn tant que maître d'œuvre, je recommande de respecter scrupuleusement l'ordre des phases :\n\n1. **Conception & Plans** : Validation complète avant début travaux\n2. **Gros œuvre** : Structure, démolition, maçonnerie\n3. **Second œuvre** : Plomberie, électricité, cloisons\n4. **Finitions** : Peinture, revêtements, pose mobilier\n\nChaque phase doit être validée avant de passer à la suivante. Souhaitez-vous des détails sur une phase particulière ?";
      }
      
      if (input.includes('budget') || input.includes('coût') || input.includes('prix')) {
        return "💰 **Gestion Budgétaire Professionnelle :**\n\nPour une gestion budgétaire optimale, je conseille :\n\n• **Réserve d'imprévus** : 10-15% du budget total\n• **Paiements échelonnés** : 30% à la commande, 40% à mi-parcours, 30% à réception\n• **Devis détaillés** : Exigez un descriptif précis des matériaux\n• **Suivi hebdomadaire** : Contrôlez les dépenses en temps réel\n\nVotre budget actuel semble bien réparti. Voulez-vous que je vérifie un poste particulier ?";
      }
      
      if (input.includes('retard') || input.includes('délai') || input.includes('timing')) {
        return "⏰ **Gestion des Délais :**\n\nLes retards sont fréquents en rénovation. Mes recommandations :\n\n• **Anticipation** : Commandez les matériaux 2 semaines à l'avance\n• **Coordination** : Planifiez les interventions avec chevauchement minimum\n• **Contrôle qualité** : Inspections régulières pour éviter les reprises\n• **Communication** : Point quotidien avec les intervenants\n\nJe peux vous alerter sur les risques potentiels de votre projet. Voulez-vous un audit de planning ?";
      }
      
      if (input.includes('qualité') || input.includes('contrôle') || input.includes('norme')) {
        return "🔍 **Contrôle Qualité & Normes :**\n\nLe contrôle qualité est essentiel. Voici mes points de vigilance :\n\n• **Électricité** : Conformité NF C 15-100, test Consuel obligatoire\n• **Plomberie** : Étanchéité, pression, évacuations\n• **Isolation** : Continuité thermique, points de rosée\n• **Finitions** : Alignements, équerrage, propreté\n\nJe recommande des photos à chaque étape. Souhaitez-vous une checklist qualité pour votre projet ?";
      }
      
      if (input.includes('problème') || input.includes('souci') || input.includes('difficile')) {
        return "🛠️ **Résolution des Problèmes :**\n\nFace aux difficultés, ma méthode :\n\n1. **Diagnostic précis** : Identifier la cause racine\n2. **Solutions alternatives** : Toujours avoir un plan B\n3. **Impact évalué** : Coût et délai des corrections\n4. **Validation client** : Accord avant modification\n\nDécrivez-moi le problème rencontré, je vous proposerai des solutions concrètes avec leur impact budgétaire et calendaire.";
      }
      
      if (input.includes('matériau') || input.includes('choix') || input.includes('technique')) {
        return "🏭 **Conseils Techniques & Matériaux :**\n\nPour les choix techniques, je privilégie :\n\n• **Durabilité** : Matériaux avec garantie longue\n• **Compatibilité** : Vérification avec l'existant\n• **Rapport qualité/prix** : Optimisation du budget\n• **Disponibilité** : Éviter les délais d'approvisionnement\n\nPour votre projet, quels matériaux vous interrogent ? Je peux vous conseiller selon vos contraintes techniques et budgétaires.";
      }
      
      if (input.includes('équipe') || input.includes('artisan') || input.includes('intervenant')) {
        return "👥 **Coordination d'Équipe :**\n\nLa coordination d'équipe est cruciale :\n\n• **Planning détaillé** : Intervention de chaque corps de métier\n• **Préparatifs** : Matériaux et outillage prêts avant intervention\n• **Communication** : Briefing quotidien, compte-rendu de fin de journée\n• **Qualité** : Contrôle en présence de l'artisan\n\nJe surveille votre équipe. Y a-t-il des tensions ou retards à signaler ?";
      }
      
      if (input.includes('sécurité') || input.includes('assurance') || input.includes('garantie')) {
        return "🛡️ **Sécurité & Garanties :**\n\nPoints de vigilance sécuritaire :\n\n• **Assurances** : RC décennale obligatoire pour gros œuvre\n• **Sécurité chantier** : EPI, signalisation, accès\n• **Garanties** : Parfait achèvement (1 an), bon fonctionnement (2 ans), décennale (10 ans)\n• **Réception** : PV détaillé avec réserves si nécessaire\n\nTous vos intervenants sont-ils correctement assurés ?";
      }
      
      // Analyse spécifique si analysisResult est disponible
      if (analysisResult) {
        if (input.includes('négocier') || input.includes('prix')) {
          return `💰 **Conseils de négociation :**\n\n${analysisResult.recommendations?.negotiation || 'Les conseils de négociation ne sont pas disponibles pour ce projet.'}\n\n📊 **Positionnement prix :** Votre devis se situe ${analysisResult.priceComparison ? 'dans la moyenne du marché local' : 'dans une fourchette acceptable'}.`;
        }
        
        if (input.includes('vigilance') || input.includes('attention')) {
          return `⚠️ **Points de vigilance identifiés :**\n\n${analysisResult.warnings?.map((w: string) => `• ${w}`).join('\n') || 'Aucun point de vigilance majeur détecté.'}\n\n🔍 **Recommandation :** Vérifiez ces éléments avant de signer.`;
        }
      }
      
      // Réponse générale pour projet
      return "🏗️ **Assistant Maître d'Œuvre IA**\n\nJe vous accompagne sur tous les aspects de votre projet :\n\n• 📋 **Gestion de projet** : Planning, phases, coordonnations\n• 💰 **Budget & coûts** : Suivi, optimisation, alertes\n• 🔨 **Techniques** : Choix matériaux, normes, qualité\n• 👥 **Équipe** : Coordination artisans, planning interventions\n• ⚠️ **Risques** : Anticipation, solutions, alternatives\n• 🛡️ **Sécurité** : Normes, assurances, garanties\n\nQue puis-je analyser ou améliorer dans votre projet ?";
    }
    
    if (context === 'collectivite') {
      if (input.includes('tendance') || input.includes('évolution')) {
        return "📈 **Tendances observées :**\n\n• **Rénovation énergétique** : +42% ce trimestre\n• **Prix matériaux** : Stabilisation après hausse de 18%\n• **Délais chantiers** : Amélioration de 15%\n• **Satisfaction citoyens** : 94% (excellent)\n\n💡 **Recommandation** : Renforcez la communication sur les aides à la rénovation énergétique.";
      }
      
      if (input.includes('aide') || input.includes('subvention')) {
        return "🎯 **Optimisation des aides publiques :**\n\n• **Taux d'utilisation actuel** : 67% des budgets alloués\n• **Secteurs sous-exploités** : Isolation combles (-23%)\n• **Délais de traitement** : Moyenne 18 jours\n\n✅ **Actions recommandées** :\n1. Campagne ciblée sur l'isolation\n2. Simplification des dossiers\n3. Accompagnement renforcé seniors";
      }

      if (input.includes('vigilance') || input.includes('arnaque')) {
        return "🚨 **Zones de vigilance détectées :**\n\n• **Quartier Nord** : 3 signalements démarchage abusif\n• **Secteur Est** : Prix pompes à chaleur +35% vs marché\n• **Entreprise surveillée** : \"Rénov Express\" (acomptes élevés)\n\n🛡️ **Actions en cours** :\n1. Alertes citoyens automatiques\n2. Renforcement contrôles\n3. Communication préventive";
      }

      if (input.includes('urbanisme') || input.includes('plan')) {
        return "🏗️ **Recommandations urbanisme :**\n\n• **Zone à densifier** : Centre-ville (potentiel +180 logements)\n• **Secteurs en tension** : Manque artisans qualifiés Sud\n• **Transition énergétique** : Objectif 85% logements rénovés d'ici 2030\n\n📋 **Intégration PLU** :\n1. Bonus constructibilité pour BBC\n2. Zones préférentielles rénovation\n3. Pôles d'excellence BTP";
      }

      return "Je peux vous aider sur de nombreux sujets : tendances territoriales, optimisation des aides, vigilance contre les arnaques, urbanisme, ou toute autre question liée à l'observatoire BTP. N'hésitez pas à être plus précis !";
    }

    // Context projet (existant)
    if (analysisResult) {
      if (input.includes('négocier') || input.includes('prix')) {
        return `💰 **Conseils de négociation :**\n\n${analysisResult.recommendations?.negotiation || 'Les conseils de négociation ne sont pas disponibles pour ce projet.'}\n\n📊 **Positionnement prix :** Votre devis se situe ${analysisResult.priceComparison ? 'dans la moyenne du marché local' : 'dans une fourchette acceptable'}.`;
      }
      
      if (input.includes('vigilance') || input.includes('attention')) {
        return `⚠️ **Points de vigilance identifiés :**\n\n${analysisResult.warnings?.map((w: string) => `• ${w}`).join('\n') || 'Aucun point de vigilance majeur détecté.'}\n\n🔍 **Recommandation :** Vérifiez ces éléments avant de signer.`;
      }
      
      if (input.includes('justification') || input.includes('pourquoi')) {
        return `📋 **Justification du prix :**\n\nLe montant proposé s'explique par :\n• Qualité des matériaux spécifiés\n• Expertise de l'entreprise (certification, expérience)\n• Complexité technique du projet\n• Conditions de marché actuelles\n\n${analysisResult.priceComparison ? `💡 Votre prix (${analysisResult.priceComparison.current}€) vs marché : ${analysisResult.priceComparison.low}€ - ${analysisResult.priceComparison.high}€` : ''}`;
      }
    }

    return "Je peux vous aider à mieux comprendre cette analyse. Posez-moi des questions sur la négociation, les points de vigilance, ou la justification des prix.";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-primary" />
          Assistant IA {context === 'collectivite' ? 'Territorial' : 'Projet'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64 overflow-y-auto space-y-3 border rounded-lg p-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                } text-sm whitespace-pre-wrap`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {context === 'collectivite' && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Questions suggérées :</h4>
            <div className="flex flex-wrap gap-2">
              {collectiviteQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage(question)}
                  className="text-xs h-8"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {context === 'project' && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Questions suggérées :</h4>
            <div className="flex flex-wrap gap-2">
              {projectQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendMessage(question)}
                  className="text-xs h-8"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Posez votre question..."
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
            className="text-sm"
          />
          <Button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatAI;