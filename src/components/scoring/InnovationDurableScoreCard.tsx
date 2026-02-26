import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Leaf,
  Zap,
  Recycle,
  MapPin,
  Cpu,
  Monitor,
  Award,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  TreePine,
} from 'lucide-react';
import type { InnovationDurableScore } from '@/scoring/criteria/innovation-durable.criteria';

interface Props {
  score: InnovationDurableScore;
  showDetails?: boolean;
}

export function InnovationDurableScoreCard({ score, showDetails = true }: Props) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'B':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'C':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'D':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'F':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 70) return 'bg-green-500';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreBadgeClass = (score: number, max: number): string => {
    const pct = (score / max) * 100;
    if (pct >= 70) return 'bg-green-100 text-green-700 border-green-200';
    if (pct >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const { performanceEnvironnementale, innovationTechnique } = score.sousAxes;

  return (
    <Card className="border-green-200/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-green-600" />
            <span>Innovation & Developpement Durable</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getGradeColor(score.grade)}>Grade {score.grade}</Badge>
            <span className="font-bold text-lg">{score.total}/50</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barre de progression globale */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Score global</span>
            <span className="font-medium">{score.pourcentage}%</span>
          </div>
          <Progress value={score.pourcentage} className="h-2" />
        </div>

        {showDetails && (
          <>
            {/* Sous-axe Performance Environnementale */}
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-green-800 flex items-center gap-2">
                  <Recycle className="h-4 w-4" />
                  Performance Environnementale
                </h5>
                <Badge variant="outline" className={getScoreBadgeClass(performanceEnvironnementale.total, 30)}>
                  {performanceEnvironnementale.total}/30
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-muted-foreground">Materiaux bas carbone</span>
                  </div>
                  <span className="font-semibold">
                    {performanceEnvironnementale.details.materiauxBasCarbone}/10
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-yellow-600" />
                    <span className="text-muted-foreground">Economies energie</span>
                  </div>
                  <span className="font-semibold">
                    {performanceEnvironnementale.details.economiesEnergetiques}/10
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <Recycle className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-muted-foreground">Gestion dechets</span>
                  </div>
                  <span className="font-semibold">
                    {performanceEnvironnementale.details.gestionDechets}/5
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-muted-foreground">Circuits courts</span>
                  </div>
                  <span className="font-semibold">
                    {performanceEnvironnementale.details.circuitsCourts}/5
                  </span>
                </div>
              </div>
            </div>

            {/* Sous-axe Innovation Technique */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-blue-800 flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Innovation Technique
                </h5>
                <Badge variant="outline" className={getScoreBadgeClass(innovationTechnique.total, 20)}>
                  {innovationTechnique.total}/20
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-muted-foreground">Solutions innovantes</span>
                  </div>
                  <span className="font-semibold">
                    {innovationTechnique.details.solutionsInnovantes}/10
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white/60 rounded">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-cyan-600" />
                    <span className="text-muted-foreground">Outils numeriques</span>
                  </div>
                  <span className="font-semibold">
                    {innovationTechnique.details.outilsNumeriques}/5
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white/60 rounded col-span-2">
                  <div className="flex items-center gap-2">
                    <Award className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-muted-foreground">Certifications innovation</span>
                  </div>
                  <span className="font-semibold">
                    {innovationTechnique.details.certificationsInnovation}/5
                  </span>
                </div>
              </div>
            </div>

            {/* Points forts detectes */}
            {score.pointsForts.length > 0 && (
              <div className="pt-2">
                <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Points forts detectes
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {score.pointsForts.map((point, i) => (
                    <Badge key={`item-${i}`} variant="outline" className="text-xs bg-green-50 border-green-200">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommandations */}
            {score.recommandations.length > 0 && (
              <div className="pt-2 border-t">
                <h5 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Recommandations
                </h5>
                <ul className="text-sm space-y-1.5">
                  {score.recommandations.map((reco, i) => (
                    <li key={`item-${i}`} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-orange-500 mt-0.5">-</span>
                      <span>{reco}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default InnovationDurableScoreCard;
