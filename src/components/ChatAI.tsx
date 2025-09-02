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
        : "Bonjour ! Je peux répondre à vos questions sur l'analyse de ce projet.",
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