import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileCheck,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Wrench
} from 'lucide-react';

interface AnalyseCompletetudeConformiteProps {
  scoreCompletude?: {
    scoreTotal?: number;
    elementsManquants?: string[];
    incoherences?: string[];
    conformiteNormes?: number;
    risquesTechniques?: string[];
  };
  scoreConformite?: {
    scoreTotal?: number;
    assurances?: boolean;
    plu?: boolean;
    normes?: boolean;
    accessibilite?: boolean;
    defauts?: string[];
  };
}

export function AnalyseCompletetudeConformite({
  scoreCompletude,
  scoreConformite
}: AnalyseCompletetudeConformiteProps) {
  if (!scoreCompletude && !scoreConformite) {
    return null;
  }

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Complétude technique */}
      {scoreCompletude && (
        <Card className="border-info/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-info" />
              Complétude Technique
              {scoreCompletude.scoreTotal !== undefined && (
                <Badge variant="secondary" className={getScoreColor((scoreCompletude.scoreTotal / 200) * 100)}>
                  {scoreCompletude.scoreTotal}/200 pts
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score conformité normes */}
            {scoreCompletude.conformiteNormes !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Conformité aux normes techniques</span>
                  <Badge variant="secondary" className={getScoreColor(scoreCompletude.conformiteNormes)}>
                    {scoreCompletude.conformiteNormes}%
                  </Badge>
                </div>
                <Progress value={scoreCompletude.conformiteNormes} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {scoreCompletude.conformiteNormes >= 80 ? 'Respect des normes DTU et réglementations en vigueur' :
                   scoreCompletude.conformiteNormes >= 60 ? 'Quelques points à clarifier sur les normes' :
                   'Plusieurs non-conformités détectées'}
                </p>
              </div>
            )}

            {/* Éléments manquants */}
            {scoreCompletude.elementsManquants && scoreCompletude.elementsManquants.length > 0 && (
              <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <h4 className="font-semibold text-foreground">Éléments manquants</h4>
                  <Badge variant="outline" className="ml-auto">{scoreCompletude.elementsManquants.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {scoreCompletude.elementsManquants.map((element, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <XCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{element}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Incohérences */}
            {scoreCompletude.incoherences && scoreCompletude.incoherences.length > 0 && (
              <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h4 className="font-semibold text-foreground">Incohérences détectées</h4>
                  <Badge variant="destructive" className="ml-auto">{scoreCompletude.incoherences.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {scoreCompletude.incoherences.map((incoherence, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{incoherence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risques techniques */}
            {scoreCompletude.risquesTechniques && scoreCompletude.risquesTechniques.length > 0 && (
              <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-warning" />
                  <h4 className="font-semibold text-foreground">Risques techniques identifiés</h4>
                  <Badge variant="outline" className="ml-auto">{scoreCompletude.risquesTechniques.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {scoreCompletude.risquesTechniques.map((risque, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{risque}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Si tout est OK */}
            {(!scoreCompletude.elementsManquants || scoreCompletude.elementsManquants.length === 0) &&
             (!scoreCompletude.incoherences || scoreCompletude.incoherences.length === 0) &&
             (!scoreCompletude.risquesTechniques || scoreCompletude.risquesTechniques.length === 0) && (
              <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm text-foreground">
                    Le devis est techniquement complet et cohérent
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conformité réglementaire */}
      {scoreConformite && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-warning" />
              Conformité Réglementaire
              {scoreConformite.scoreTotal !== undefined && (
                <Badge variant="secondary" className={getScoreColor((scoreConformite.scoreTotal / 150) * 100)}>
                  {scoreConformite.scoreTotal}/150 pts
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Checklist conformité */}
            <div className="grid gap-3">
              {/* Assurances */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {scoreConformite.assurances ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-foreground">Assurances obligatoires</div>
                    <div className="text-xs text-muted-foreground">Décennale et RC Pro</div>
                  </div>
                </div>
                <Badge variant={scoreConformite.assurances ? "default" : "destructive"}>
                  {scoreConformite.assurances ? 'Conforme' : 'Non conforme'}
                </Badge>
              </div>

              {/* PLU/Urbanisme */}
              {scoreConformite.plu !== undefined && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {scoreConformite.plu ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">Conformité urbanisme (PLU)</div>
                      <div className="text-xs text-muted-foreground">Plan Local d'Urbanisme</div>
                    </div>
                  </div>
                  <Badge variant={scoreConformite.plu ? "default" : "outline"}>
                    {scoreConformite.plu ? 'Vérifié' : 'À vérifier'}
                  </Badge>
                </div>
              )}

              {/* Normes construction */}
              {scoreConformite.normes !== undefined && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {scoreConformite.normes ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">Normes de construction</div>
                      <div className="text-xs text-muted-foreground">RT2012, RE2020, NF, DTU</div>
                    </div>
                  </div>
                  <Badge variant={scoreConformite.normes ? "default" : "destructive"}>
                    {scoreConformite.normes ? 'Conforme' : 'Non conforme'}
                  </Badge>
                </div>
              )}

              {/* Accessibilité */}
              {scoreConformite.accessibilite !== undefined && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {scoreConformite.accessibilite ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">Accessibilité PMR</div>
                      <div className="text-xs text-muted-foreground">Si applicable</div>
                    </div>
                  </div>
                  <Badge variant={scoreConformite.accessibilite ? "default" : "outline"}>
                    {scoreConformite.accessibilite ? 'Conforme' : 'N/A'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Défauts de conformité */}
            {scoreConformite.defauts && scoreConformite.defauts.length > 0 && (
              <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h4 className="font-semibold text-foreground">Points de non-conformité</h4>
                  <Badge variant="destructive" className="ml-auto">{scoreConformite.defauts.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {scoreConformite.defauts.map((defaut, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{defaut}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Si tout est conforme */}
            {(!scoreConformite.defauts || scoreConformite.defauts.length === 0) &&
             scoreConformite.assurances &&
             scoreConformite.normes && (
              <div className="p-4 bg-success/5 rounded-lg border border-success/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm text-foreground">
                    Le devis est conforme aux exigences réglementaires
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
