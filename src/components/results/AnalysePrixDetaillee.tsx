import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle,
  Percent,
  ArrowUpDown
} from 'lucide-react';

interface AnalysePrixProps {
  scorePrix?: {
    scoreTotal?: number;
    vsMarche?: number;
    transparence?: number;
    coherence?: number;
    margeEstimee?: number;
    ajustementQualite?: number;
    economiesPotentielles?: number;
  };
  montantTotal?: number;
  margeNegociation?: {
    min: number;
    max: number;
  };
  surcoutsDetectes?: number;
  budgetRealEstime?: number;
  comparaisonMarche?: {
    low: number;
    current: number;
    high: number;
  };
}

export function AnalysePrixDetaillee({
  scorePrix,
  montantTotal,
  margeNegociation,
  surcoutsDetectes,
  budgetRealEstime,
  comparaisonMarche
}: AnalysePrixProps) {
  if (!scorePrix && !montantTotal) {
    return null;
  }

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getPositionMarche = () => {
    if (!comparaisonMarche) return null;
    const { low, current, high } = comparaisonMarche;
    const position = ((current - low) / (high - low)) * 100;

    if (position < 40) return { label: 'Prix attractif', color: 'text-success', icon: TrendingDown };
    if (position < 60) return { label: 'Prix marché', color: 'text-info', icon: Target };
    return { label: 'Prix élevé', color: 'text-warning', icon: TrendingUp };
  };

  const positionMarche = getPositionMarche();

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Analyse de Prix Détaillée
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vue d'ensemble */}
        {montantTotal !== undefined && (
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Montant total du devis</span>
              {positionMarche && (
                <Badge variant="secondary" className={positionMarche.color}>
                  <positionMarche.icon className="w-3 h-3 mr-1" />
                  {positionMarche.label}
                </Badge>
              )}
            </div>
            <div className="text-3xl font-bold text-foreground">
              {montantTotal.toLocaleString('fr-FR')} €
            </div>

            {budgetRealEstime && budgetRealEstime !== montantTotal && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Budget réel estimé: </span>
                <span className={`font-semibold ${budgetRealEstime > montantTotal ? 'text-warning' : 'text-success'}`}>
                  {budgetRealEstime.toLocaleString('fr-FR')} €
                </span>
              </div>
            )}

            {surcoutsDetectes !== undefined && surcoutsDetectes > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                <AlertCircle className="w-4 h-4" />
                <span>Surcoûts potentiels détectés: {surcoutsDetectes.toLocaleString('fr-FR')} €</span>
              </div>
            )}
          </div>
        )}

        {/* Marge de négociation */}
        {margeNegociation && (
          <div className="p-4 bg-success/5 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpDown className="w-4 h-4 text-success" />
              <h4 className="font-semibold text-foreground">Marge de négociation estimée</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Négociation prudente</div>
                <div className="text-xl font-bold text-success">
                  {margeNegociation.min.toLocaleString('fr-FR')} €
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {montantTotal ? `(-${Math.round((margeNegociation.min / montantTotal) * 100)}%)` : ''}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Négociation optimiste</div>
                <div className="text-xl font-bold text-success">
                  {margeNegociation.max.toLocaleString('fr-FR')} €
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {montantTotal ? `(-${Math.round((margeNegociation.max / montantTotal) * 100)}%)` : ''}
                </div>
              </div>
            </div>

            {scorePrix?.economiesPotentielles !== undefined && scorePrix.economiesPotentielles > 0 && (
              <div className="mt-3 p-2 bg-success/10 rounded text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-foreground">
                  Économies potentielles identifiées: <strong>{scorePrix.economiesPotentielles.toLocaleString('fr-FR')} €</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Scores détaillés */}
        {scorePrix && (
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Critères d'évaluation</h4>

            {scorePrix.vsMarche !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cohérence avec le marché</span>
                  <Badge variant="secondary" className={getScoreColor(scorePrix.vsMarche)}>
                    {scorePrix.vsMarche}%
                  </Badge>
                </div>
                <Progress value={scorePrix.vsMarche} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {scorePrix.vsMarche >= 80 ? 'Prix aligné avec le marché local' :
                   scorePrix.vsMarche >= 60 ? 'Prix légèrement au-dessus du marché' :
                   'Prix significativement supérieur au marché'}
                </p>
              </div>
            )}

            {scorePrix.transparence !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Transparence tarifaire</span>
                  <Badge variant="secondary" className={getScoreColor(scorePrix.transparence)}>
                    {scorePrix.transparence}%
                  </Badge>
                </div>
                <Progress value={scorePrix.transparence} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {scorePrix.transparence >= 80 ? 'Détail complet des postes et prix unitaires' :
                   scorePrix.transparence >= 60 ? 'Certains postes manquent de détail' :
                   'Manque de transparence dans le chiffrage'}
                </p>
              </div>
            )}

            {scorePrix.coherence !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cohérence interne</span>
                  <Badge variant="secondary" className={getScoreColor(scorePrix.coherence)}>
                    {scorePrix.coherence}%
                  </Badge>
                </div>
                <Progress value={scorePrix.coherence} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {scorePrix.coherence >= 80 ? 'Prix cohérents entre les postes' :
                   scorePrix.coherence >= 60 ? 'Quelques incohérences mineures' :
                   'Incohérences importantes détectées'}
                </p>
              </div>
            )}

            {scorePrix.margeEstimee !== undefined && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Marge estimée de l'entreprise
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {scorePrix.margeEstimee}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {scorePrix.margeEstimee <= 15 ? 'Marge faible (risque financier pour l\'entreprise)' :
                   scorePrix.margeEstimee <= 25 ? 'Marge raisonnable' :
                   scorePrix.margeEstimee <= 35 ? 'Marge élevée (place à la négociation)' :
                   'Marge très élevée (négociation fortement recommandée)'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Comparaison marché détaillée */}
        {comparaisonMarche && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-foreground">Position sur le marché local</h4>

            <div className="relative h-16 bg-gradient-to-r from-success/20 via-warning/20 to-destructive/20 rounded-lg overflow-hidden">
              {/* Marqueur position actuelle */}
              <div
                className="absolute top-0 h-full w-1 bg-primary"
                style={{
                  left: `${((comparaisonMarche.current - comparaisonMarche.low) / (comparaisonMarche.high - comparaisonMarche.low)) * 100}%`
                }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <Badge variant="default" className="bg-primary">
                    Votre devis
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Fourchette basse</div>
                <div className="text-sm font-semibold text-foreground">
                  {comparaisonMarche.low.toLocaleString('fr-FR')} €
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Marché médian</div>
                <div className="text-sm font-semibold text-foreground">
                  {Math.round((comparaisonMarche.low + comparaisonMarche.high) / 2).toLocaleString('fr-FR')} €
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fourchette haute</div>
                <div className="text-sm font-semibold text-foreground">
                  {comparaisonMarche.high.toLocaleString('fr-FR')} €
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Basé sur l'analyse de devis similaires dans votre région
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
