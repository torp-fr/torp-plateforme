import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Bot, User, Lightbulb } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ChatAIProps {
  projectId: string;
  analysisResult: any;
}

const suggestedQuestions = [
  "Comment puis-je négocier le prix de ce devis ?",
  "Quels sont les points de vigilance principaux ?",
  "Ce prix est-il justifié pour ce type de travaux ?",
  "Que faire si l'entreprise refuse mes demandes ?",
  "Comment vérifier la qualité des matériaux proposés ?"
];

export function ChatAI({ projectId, analysisResult }: ChatAIProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: `Bonjour ! Je suis votre assistant TORP. J'ai analysé votre devis et je peux vous aider à mieux comprendre les résultats, négocier avec l'entreprise, ou répondre à toutes vos questions sur ce projet.

Votre devis a obtenu un score de ${analysisResult.score || 'N/A'}/100. Comment puis-je vous aider ?`,
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Ajouter le message utilisateur
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    // Simuler la réponse de l'IA
    setTimeout(() => {
      const aiResponse = generateAIResponse(message, analysisResult);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userMessage: string, analysis: any): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('négocier') || lowerMessage.includes('prix')) {
      return `Pour négocier ce devis efficacement :

🔸 **Points de négociation identifiés :**
- L'acompte de 30% peut être réduit à 20%
- Demandez un échelonnement des paiements selon l'avancement
- Le délai de livraison doit être précisé contractuellement

🔸 **Arguments à utiliser :**
- Votre budget initial était plus bas
- Demandez des références récentes
- Exigez des garanties écrites sur les matériaux

💡 **Conseil TORP :** Préparez 2-3 alternatives avant la négociation pour avoir plus de leviers.`;
    }

    if (lowerMessage.includes('vigilance') || lowerMessage.includes('attention')) {
      return `Voici les points de vigilance principaux sur ce devis :

⚠️ **Points critiques détectés :**
${analysis.warnings?.map((w: string) => `- ${w}`).join('\n') || '- Aucun point critique majeur'}

🔍 **Ce que vous devez vérifier :**
- Assurance décennale à jour (demandez l'attestation)
- Références d'entreprise récentes
- Détail précis des matériaux utilisés
- Planning détaillé des interventions

📋 **Questions essentielles à poser :**
${analysis.recommendations?.questions?.map((q: string) => `- ${q}`).join('\n') || '- Demandez des clarifications sur les garanties'}`;
    }

    if (lowerMessage.includes('justifié') || lowerMessage.includes('prix')) {
      return `Analyse du prix de votre devis :

💰 **Positionnement prix :**
- Votre devis : ${analysis.priceComparison?.current?.toLocaleString() || 'N/A'}€
- Marché local : ${analysis.priceComparison?.low?.toLocaleString() || 'N/A'}€ - ${analysis.priceComparison?.high?.toLocaleString() || 'N/A'}€

✅ **Le prix semble ${analysis.score >= 70 ? 'justifié' : 'élevé'} car :**
${analysis.strengths?.slice(0, 2).map((s: string) => `- ${s}`).join('\n') || '- Analyse en cours...'}

🎯 **Recommandation :** ${analysis.score >= 80 ? 'Prix compétitif, vous pouvez accepter' : 'Négociation recommandée, marge de 5-10% possible'}`;
    }

    // Réponse générale
    return `Je comprends votre question. Basé sur l'analyse de votre devis (score ${analysis.score}/100), voici ce que je peux vous dire :

${analysis.recommendations?.negotiation || 'Votre projet présente un bon niveau de qualité dans l\'ensemble.'}

💡 **Pour aller plus loin :**
- Consultez le rapport PDF complet
- Comparez avec d'autres devis si disponibles
- N'hésitez pas à me poser des questions plus spécifiques

Que souhaitez-vous savoir d'autre sur ce devis ?`;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Assistant IA TORP
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <div className="flex items-start gap-2">
                  {message.type === 'ai' && <Bot className="w-4 h-4 mt-0.5 text-primary" />}
                  {message.type === 'user' && <User className="w-4 h-4 mt-0.5" />}
                  <div className="text-sm whitespace-pre-line">{message.content}</div>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Questions suggérées */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="w-4 h-4" />
            Questions suggérées :
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 3).map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2"
                onClick={() => handleSendMessage(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Posez votre question sur ce devis..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(currentMessage)}
            className="flex-1"
          />
          <Button 
            onClick={() => handleSendMessage(currentMessage)}
            disabled={!currentMessage.trim() || isTyping}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}