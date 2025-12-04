/**
 * Composant d'affichage de l'analyse de transparence
 *
 * Affiche :
 * - Score global de transparence
 * - Détail par critère avec barres de progression
 * - Points forts et points faibles
 * - Recommandations d'amélioration
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Calculator,
  Calendar,
  Shield,
  Image,
  BookOpen,
  Stamp,
} from 'lucide-react';
import type { TransparencyAnalysis, CritereScore } from '@/services/scoring/transparency-scoring.service';

interface TransparencyCardProps {
  analysis: TransparencyAnalysis;
  compact?: boolean;
}

// Icônes par critère
const CRITERE_ICONS: Record<string, React.ElementType> = {
  mentionsLegales: Shield,
  detailPrestations: FileText,
  decompositionPrix: Calculator,
  conditionsGenerales: BookOpen,
  planningPrevisionnel: Calendar,
  referencesTechniques: FileCheck,
  elementsVisuels: Image,
  certificationDevis: Stamp,
};

// Couleurs par niveau
const NIVEAU_COLORS: Record<string, string> = {
  'Excellent': 'bg-green-500 text-white',
  'Bon': 'bg-blue-500 text-white',
  'Acceptable': 'bg-yellow-500 text-white',
  'Insuffisant': 'bg-orange-500 text-white',
  'Critique': 'bg-red-500 text-white',
};

const CRITERE_NIVEAU_COLORS: Record<string, string> = {
  'Complet': 'text-green-600 bg-green-100 border-green-200',
  'Partiel': 'text-yellow-600 bg-yellow-100 border-yellow-200',
  'Absent': 'text-red-600 bg-red-100 border-red-200',
};

export function TransparencyCard({ analysis, compact = false }: TransparencyCardProps) {
  const criteresArray = Object.entries(analysis.criteres);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Transparence du devis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={NIVEAU_COLORS[analysis.niveau]}>
              {analysis.niveau}
            </Badge>
            <span className="text-2xl font-bold">
              {analysis.scoreTotal}/100
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barre de progression globale */}
        <div className="space-y-1">
          <Progress value={analysis.scoreTotal} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">
            Score de documentation
          </p>
        </div>

        {/* Critères détaillés */}
        {!compact && (
          <div className="space-y-3 mt-4">
            <h4 className="text-sm font-medium">Détail par critère</h4>
            {criteresArray.map(([key, critere]) => (
              <CritereRow key={key} critereKey={key} critere={critere} />
            ))}
          </div>
        )}

        {/* Mode compact : juste les badges */}
        {compact && (
          <div className="flex flex-wrap gap-2">
            {criteresArray.map(([key, critere]) => {
              const Icon = CRITERE_ICONS[key] || FileText;
              return (
                <Badge
                  key={key}
                  variant="outline"
                  className={`${CRITERE_NIVEAU_COLORS[critere.niveau]} text-xs`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {critere.nom}: {critere.score}/{critere.scoreMax}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Points forts */}
        {analysis.pointsForts.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-green-700 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Points forts
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.pointsForts.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Points faibles */}
        {analysis.pointsFaibles.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-orange-700 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Points d'attention
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {analysis.pointsFaibles.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">!</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommandations */}
        {!compact && analysis.recommandations.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg space-y-2">
            <h4 className="text-sm font-medium text-blue-700">
              Recommandations
            </h4>
            <ul className="text-sm text-blue-600 space-y-1">
              {analysis.recommandations.map((reco, i) => (
                <li key={i}>• {reco}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sous-composant pour une ligne de critère
function CritereRow({ critereKey, critere }: { critereKey: string; critere: CritereScore }) {
  const Icon = CRITERE_ICONS[critereKey] || FileText;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{critere.nom}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={CRITERE_NIVEAU_COLORS[critere.niveau]}>
            {critere.niveau}
          </Badge>
          <span className="font-medium w-12 text-right">
            {critere.score}/{critere.scoreMax}
          </span>
        </div>
      </div>
      <Progress value={critere.pourcentage} className="h-1.5" />

      {/* Éléments manquants (si critère partiel/absent) */}
      {critere.niveau !== 'Complet' && critere.elementsManquants.length > 0 && (
        <p className="text-xs text-muted-foreground pl-6">
          Manquant : {critere.elementsManquants.slice(0, 3).join(', ')}
          {critere.elementsManquants.length > 3 && '...'}
        </p>
      )}
    </div>
  );
}

export default TransparencyCard;
