import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  MessageSquare,
  FileCheck,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface ConseilsPersonnalisesProps {
  grade: string;
  scoreTotal: number;
  scoreEntreprise?: number;
  scorePrix?: number;
  scoreCompletude?: number;
  scoreConformite?: number;
  scoreDelais?: number;
  recommendations?: {
    questions?: string[];
    negotiation?: string | null;
    actions?: Array<{
      type: string;
      priorite: string;
      titre: string;
      description: string;
      actionSuggeree: string;
      impactBudget?: number;
      delaiAction?: number;
    }>;
  };
}

export function ConseilsPersonnalises({
  grade,
  scoreTotal,
  scoreEntreprise,
  scorePrix,
  scoreCompletude,
  scoreConformite,
  scoreDelais,
  recommendations
}: ConseilsPersonnalisesProps) {
  // Générer des conseils contextuels basés sur les scores
  const getConseilsContextuels = () => {
    const conseils = [];

    // Basé sur le score global
    if (scoreTotal >= 800) {
      conseils.push({
        icon: CheckCircle,
        color: 'text-success',
        titre: 'Excellent devis',
        description: 'Ce devis présente tous les critères de qualité. Vous pouvez procéder en confiance.',
        action: 'Accepter le devis et fixer une date de début des travaux'
      });
    } else if (scoreTotal >= 700) {
      conseils.push({
        icon: Lightbulb,
        color: 'text-info',
        titre: 'Bon devis',
        description: 'Le devis est globalement satisfaisant. Quelques points peuvent être optimisés.',
        action: 'Clarifier les points mineurs avant de signer'
      });
    } else if (scoreTotal >= 600) {
      conseils.push({
        icon: AlertTriangle,
        color: 'text-warning',
        titre: 'Devis à améliorer',
        description: 'Plusieurs points importants nécessitent une attention particulière.',
        action: 'Négocier les points faibles identifiés avant acceptation'
      });
    } else {
      conseils.push({
        icon: AlertTriangle,
        color: 'text-destructive',
        titre: 'Devis problématique',
        description: 'De nombreux problèmes ont été identifiés. La prudence est de mise.',
        action: 'Demander un nouveau devis corrigé ou consulter d\'autres entreprises'
      });
    }

    // Basé sur le score entreprise
    if (scoreEntreprise !== undefined && scoreEntreprise < 60) {
      conseils.push({
        icon: Shield,
        color: 'text-warning',
        titre: 'Vérifier la fiabilité de l\'entreprise',
        description: 'Des doutes subsistent sur la crédibilité de cette entreprise.',
        action: 'Vérifier SIRET, assurances et références clients avant de signer'
      });
    }

    // Basé sur le score prix
    if (scorePrix !== undefined && scorePrix < 60) {
      conseils.push({
        icon: ArrowRight,
        color: 'text-warning',
        titre: 'Prix à négocier',
        description: 'Le prix semble élevé ou manque de transparence.',
        action: 'Demander un détail complet et comparer avec d\'autres devis'
      });
    }

    // Basé sur le score complétude
    if (scoreCompletude !== undefined && scoreCompletude < 60) {
      conseils.push({
        icon: FileCheck,
        color: 'text-warning',
        titre: 'Devis incomplet',
        description: 'Des éléments essentiels manquent dans le devis.',
        action: 'Demander un complément avec toutes les spécifications techniques'
      });
    }

    // Basé sur le score conformité
    if (scoreConformite !== undefined && scoreConformite < 60) {
      conseils.push({
        icon: Shield,
        color: 'text-destructive',
        titre: 'Problème de conformité',
        description: 'Le devis ne respecte pas certaines obligations réglementaires.',
        action: 'Exiger la mise en conformité avant tout engagement'
      });
    }

    // Basé sur le score délais
    if (scoreDelais !== undefined && scoreDelais < 60) {
      conseils.push({
        icon: Clock,
        color: 'text-warning',
        titre: 'Délais à clarifier',
        description: 'Les délais annoncés semblent irréalistes ou mal définis.',
        action: 'Demander un planning détaillé avec clauses de pénalités'
      });
    }

    return conseils;
  };

  const conseils = getConseilsContextuels();

  // Prioriser les actions urgentes
  const actionsUrgentes = recommendations?.actions?.filter(a => a.priorite === 'haute') || [];

  return (
    <div className="space-y-6">
      {/* Verdict global */}
      <Card className={`border-2 ${
        scoreTotal >= 800 ? 'border-success/50 bg-success/5' :
        scoreTotal >= 700 ? 'border-info/50 bg-info/5' :
        scoreTotal >= 600 ? 'border-warning/50 bg-warning/5' :
        'border-destructive/50 bg-destructive/5'
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className={`w-5 h-5 ${
              scoreTotal >= 800 ? 'text-success' :
              scoreTotal >= 700 ? 'text-info' :
              scoreTotal >= 600 ? 'text-warning' :
              'text-destructive'
            }`} />
            Notre Recommandation
            <Badge variant="outline" className="ml-auto text-lg px-3 py-1">
              Grade {grade}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {conseils.map((conseil, index) => (
            <div key={`conseil-${index}`} className="space-y-2">
              <div className="flex items-start gap-3">
                <conseil.icon className={`w-5 h-5 ${conseil.color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">{conseil.titre}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{conseil.description}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">{conseil.action}</span>
                  </div>
                </div>
              </div>
              {index < conseils.length - 1 && <div className="border-t mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions prioritaires */}
      {actionsUrgentes.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Actions Urgentes
              <Badge variant="destructive" className="ml-auto">{actionsUrgentes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionsUrgentes.map((action, index) => (
              <div key={`warning-${index}`} className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-semibold text-foreground">{action.titre}</h5>
                  {action.delaiAction && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Sous {action.delaiAction}j
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{action.description}</p>
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="font-medium text-foreground">{action.actionSuggeree}</span>
                </div>
                {action.impactBudget && (
                  <div className="mt-2 text-sm text-success">
                    💰 Économie potentielle : {action.impactBudget.toLocaleString('fr-FR')} €
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Prochaines étapes recommandées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Prochaines Étapes Recommandées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scoreTotal >= 800 ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Valider les derniers détails</h5>
                    <p className="text-sm text-muted-foreground">Confirmez la date de début et les modalités de paiement</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Signer le devis</h5>
                    <p className="text-sm text-muted-foreground">Le devis peut être accepté en l'état</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Préparer le chantier</h5>
                    <p className="text-sm text-muted-foreground">Anticipez les aspects logistiques avec l'entreprise</p>
                  </div>
                </div>
              </>
            ) : scoreTotal >= 600 ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-warning">1</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Rencontrer l'entreprise</h5>
                    <p className="text-sm text-muted-foreground">Clarifiez les points identifiés dans l'analyse</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-warning">2</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Négocier les points faibles</h5>
                    <p className="text-sm text-muted-foreground">Utilisez les recommandations TORP comme base</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-warning">3</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Demander un avenant</h5>
                    <p className="text-sm text-muted-foreground">Obtenez un devis corrigé avant signature</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-destructive">1</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Demander un nouveau devis</h5>
                    <p className="text-sm text-muted-foreground">Trop de problèmes ont été identifiés</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-destructive">2</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Consulter d'autres entreprises</h5>
                    <p className="text-sm text-muted-foreground">Comparez avec au moins 2-3 autres devis</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-destructive">3</span>
                  </div>
                  <div>
                    <h5 className="font-semibold text-foreground mb-1">Faire appel à un expert</h5>
                    <p className="text-sm text-muted-foreground">Un architecte ou maître d'œuvre peut vous aider</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <Button className="w-full mt-6">
            <MessageSquare className="w-4 h-4 mr-2" />
            Obtenir un accompagnement personnalisé
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
