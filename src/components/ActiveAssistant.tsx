import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  MessageCircle,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';

interface AssistantProps {
  userType: 'B2B' | 'B2C' | 'B2G' | 'B2B2C';
  context?: string;
}

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'success' | 'info' | 'action';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionCallback?: () => void;
  timestamp: Date;
}

export function ActiveAssistant({ userType, context }: AssistantProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);

  // Génération d'insights intelligents selon le type d'utilisateur
  useEffect(() => {
    const generateInsights = () => {
      const currentTime = new Date();
      let newInsights: Insight[] = [];

      switch (userType) {
        case 'B2B':
          newInsights = [
            {
              id: '1',
              type: 'opportunity',
              title: 'Opportunité de relance',
              message: '3 prospects chauds n\'ont pas été recontactés depuis 5 jours. Taux de conversion +40% avec relance rapide.',
              priority: 'high',
              actionLabel: 'Planifier relances',
              timestamp: currentTime
            },
            {
              id: '2',
              type: 'action',
              title: 'Optimisation devis',
              message: 'Vos devis avec analyse TORP ont un taux d\'acceptation 34% supérieur. Recommandez l\'analyse systématique.',
              priority: 'medium',
              actionLabel: 'Configurer auto-analyse',
              timestamp: currentTime
            },
            {
              id: '3',
              type: 'success',
              title: 'Performance excellente',
              message: 'Votre score TORP moyen (8.7/10) vous place dans le top 5% des entreprises. Utilisez cet avantage commercial.',
              priority: 'low',
              actionLabel: 'Télécharger certificat',
              timestamp: currentTime
            }
          ];
          break;

        case 'B2C':
          newInsights = [
            {
              id: '1',
              type: 'warning',
              title: 'Alerte devis',
              message: 'Le devis Renovation Plus présente 3 alertes majeures. Analyse détaillée recommandée avant signature.',
              priority: 'high',
              actionLabel: 'Analyser maintenant',
              timestamp: currentTime
            },
            {
              id: '2',
              type: 'info',
              title: 'Conseil projet',
              message: 'Pour votre type de rénovation, la période optimale est mars-mai. Planification recommandée.',
              priority: 'medium',
              actionLabel: 'Voir le planning',
              timestamp: currentTime
            }
          ];
          break;

        case 'B2G':
          newInsights = [
            {
              id: '1',
              type: 'opportunity',
              title: 'Économies détectées',
              message: 'Optimisation maintenance prédictive: 15% d\'économies possibles sur 3 bâtiments prioritaires.',
              priority: 'high',
              actionLabel: 'Voir le plan',
              timestamp: currentTime
            },
            {
              id: '2',
              type: 'warning',
              title: 'Échéance réglementaire',
              message: 'Mise en conformité PMR obligatoire avant juin 2024 sur le groupe scolaire Voltaire.',
              priority: 'high',
              actionLabel: 'Planifier travaux',
              timestamp: currentTime
            },
            {
              id: '3',
              type: 'success',
              title: 'Subvention disponible',
              message: 'Nouvelle aide rénovation énergétique: jusqu\'à 45% de financement pour 2 de vos bâtiments.',
              priority: 'medium',
              actionLabel: 'Faire demande',
              timestamp: currentTime
            }
          ];
          break;

        case 'B2B2C':
          newInsights = [
            {
              id: '1',
              type: 'opportunity',
              title: 'Crédibilité renforcée',
              message: 'Vos certifications TORP augmentent la satisfaction client de +67%. Communiquez davantage sur cette valeur ajoutée.',
              priority: 'medium',
              actionLabel: 'Kit communication',
              timestamp: currentTime
            },
            {
              id: '2',
              type: 'action',
              title: 'Analyse recommandée',
              message: 'Devis copropriété Les Jardins: montant élevé détecté (124k€). Certification TORP recommandée.',
              priority: 'high',
              actionLabel: 'Analyser le devis',
              timestamp: currentTime
            }
          ];
          break;
      }

      setInsights(newInsights);
    };

    generateInsights();
    
    // Mise à jour périodique des insights
    const interval = setInterval(generateInsights, 30000); // Toutes les 30 secondes
    return () => clearInterval(interval);
  }, [userType, context]);

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-success" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'action': return <Zap className="h-4 w-4 text-primary" />;
      default: return <Lightbulb className="h-4 w-4 text-info" />;
    }
  };

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity': return 'success';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'action': return 'default';
      default: return 'secondary';
    }
  };

  const getPriorityColor = (priority: Insight['priority']) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-96">
      <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 rounded">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm">Assistant IA TORP</CardTitle>
              <Badge variant="outline" className="text-xs">
                {insights.length} recommandations
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? 
                  <Maximize2 className="h-3 w-3" /> : 
                  <Minimize2 className="h-3 w-3" />
                }
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsVisible(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="space-y-3 max-h-64 overflow-y-auto">
            {insights.map((insight) => (
              <div 
                key={insight.id} 
                className="p-3 bg-muted/30 rounded-lg border border-border/50"
              >
                <div className="flex items-start gap-3 mb-2">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{insight.title}</h4>
                      <Badge variant={getPriorityColor(insight.priority)} className="text-xs">
                        {insight.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {insight.message}
                    </p>
                  </div>
                </div>
                
                {insight.actionLabel && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {insight.timestamp.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    <Button 
                      size="sm" 
                      variant={getInsightColor(insight.type) as any}
                      className="text-xs h-7"
                      onClick={insight.actionCallback}
                    >
                      {insight.actionLabel}
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            {insights.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune recommandation pour le moment</p>
                <p className="text-xs">L'IA analyse votre activité en continu</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}