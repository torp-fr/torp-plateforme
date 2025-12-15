/**
 * OffresTab - Composant pour l'onglet Analyse des Offres
 * Extrait de Phase1Consultation.tsx pour meilleure maintenabilité
 */

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  FileSearch,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { OffreService } from '@/services/phase1/offre.service';
import { phase1PDFService } from '@/services/phase1/pdf-export.service';
import { useToast } from '@/hooks/use-toast';
import type { Offre, AnalyseOffre, TableauComparatif } from '@/types/phase1/offre.types';
import type { UserType } from '@/types/user.types';

interface OffresTabProps {
  consultationId: string;
  offres: Offre[];
  userType: UserType;
  onOffreSelect?: (offreId: string) => void;
  onAnalyseComplete?: (analyse: TableauComparatif) => void;
}

export function OffresTab({
  consultationId,
  offres,
  userType,
  onOffreSelect,
  onAnalyseComplete
}: OffresTabProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<Record<string, AnalyseOffre>>({});
  const [tableauComparatif, setTableauComparatif] = useState<TableauComparatif | null>(null);

  // Analyser toutes les offres
  const handleAnalyzeAll = useCallback(async () => {
    if (offres.length === 0) {
      toast({
        title: 'Aucune offre',
        description: 'Aucune offre à analyser',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const newAnalyses: Record<string, AnalyseOffre> = {};

      for (const offre of offres) {
        const analyse = await OffreService.analyzeOffre(offre);
        newAnalyses[offre.id] = analyse;
      }

      setAnalyses(newAnalyses);

      // Générer tableau comparatif
      const tableau = await OffreService.generateTableauComparatif(offres, newAnalyses);
      setTableauComparatif(tableau);
      onAnalyseComplete?.(tableau);

      toast({
        title: 'Analyse terminée',
        description: `${offres.length} offre(s) analysée(s)`,
      });
    } catch (error) {
      console.error('Erreur analyse offres:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'analyse des offres',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [offres, onAnalyseComplete, toast]);

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    if (offres.length === 0 || Object.keys(analyses).length === 0) {
      toast({
        title: 'Export impossible',
        description: 'Analysez d\'abord les offres',
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await phase1PDFService.exportAnalyseOffres(offres, { offres: analyses });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analyse-offres-${consultationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: 'Le rapport a été téléchargé',
      });
    } catch (error) {
      toast({
        title: 'Erreur export',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    }
  }, [offres, analyses, consultationId, toast]);

  // Offres triées par note globale
  const sortedOffres = useMemo(() => {
    return [...offres].sort((a, b) => {
      const scoreA = analyses[a.id]?.noteGlobale || 0;
      const scoreB = analyses[b.id]?.noteGlobale || 0;
      return scoreB - scoreA;
    });
  }, [offres, analyses]);

  // Labels adaptés au profil
  const getLabels = () => {
    switch (userType) {
      case 'B2C':
        return {
          title: 'Comparer les devis',
          description: 'Analysez et comparez les devis reçus',
          analyzeBtn: 'Analyser les devis',
          exportBtn: 'Télécharger le comparatif',
        };
      case 'B2B':
        return {
          title: 'Mon offre',
          description: 'Préparez et soumettez votre offre',
          analyzeBtn: 'Vérifier mon offre',
          exportBtn: 'Exporter',
        };
      case 'B2G':
        return {
          title: 'Analyse des offres',
          description: 'Analyse et classement des offres reçues',
          analyzeBtn: 'Analyser les offres',
          exportBtn: 'Rapport d\'analyse',
        };
      default:
        return {
          title: 'Offres',
          description: 'Gestion des offres',
          analyzeBtn: 'Analyser',
          exportBtn: 'Exporter',
        };
    }
  };

  const labels = getLabels();

  // Affichage pour B2B (préparation offre)
  if (userType === 'B2B') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              La préparation d'offre B2B sera disponible dans une prochaine version.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>
                {offres.length} offre{offres.length > 1 ? 's' : ''} reçue{offres.length > 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAnalyzeAll}
                disabled={isAnalyzing || offres.length === 0}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-4 h-4 mr-2" />
                    {labels.analyzeBtn}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={Object.keys(analyses).length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                {labels.exportBtn}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tableau comparatif */}
      {offres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Tableau comparatif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rang</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead className="text-right">Prix HT</TableHead>
                  <TableHead className="text-center">Note Tech.</TableHead>
                  <TableHead className="text-center">Note Prix</TableHead>
                  <TableHead className="text-center">Note Globale</TableHead>
                  <TableHead className="text-center">Conformité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOffres.map((offre, index) => {
                  const analyse = analyses[offre.id];
                  const isFirst = index === 0 && analyse?.noteGlobale;

                  return (
                    <TableRow
                      key={offre.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isFirst ? 'bg-green-50' : ''}`}
                      onClick={() => onOffreSelect?.(offre.id)}
                    >
                      <TableCell>
                        <Badge variant={isFirst ? 'default' : 'secondary'}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {offre.entreprise?.identification?.raisonSociale || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {offre.contenu?.propositionFinanciere?.montantTotalHT?.toLocaleString('fr-FR')} €
                      </TableCell>
                      <TableCell className="text-center">
                        {analyse ? (
                          <ScoreBadge score={analyse.noteTechnique} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {analyse ? (
                          <ScoreBadge score={analyse.notePrix} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {analyse ? (
                          <ScoreBadge score={analyse.noteGlobale} highlight />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ConformityBadge conformite={analyse?.conformite} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recommandation */}
      {tableauComparatif && sortedOffres.length > 0 && analyses[sortedOffres[0].id] && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <TrendingUp className="w-5 h-5" />
              Recommandation TORP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-800">
              L'offre de <strong>{sortedOffres[0].entreprise?.identification?.raisonSociale}</strong> présente
              le meilleur rapport qualité/prix avec une note globale de{' '}
              <strong>{analyses[sortedOffres[0].id]?.noteGlobale}/100</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* État vide */}
      {offres.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSearch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune offre reçue</p>
            <p className="text-sm text-muted-foreground mt-2">
              Les offres des entreprises apparaîtront ici
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Composant badge score
function ScoreBadge({ score, highlight }: { score?: number; highlight?: boolean }) {
  if (score === undefined) return <span className="text-muted-foreground">-</span>;

  const getColor = () => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Badge
      className={`${getColor()} ${highlight ? 'font-bold' : ''}`}
      variant="secondary"
    >
      {score}/100
    </Badge>
  );
}

// Composant badge conformité
function ConformityBadge({ conformite }: { conformite?: { administrative?: boolean; technique?: boolean } }) {
  if (!conformite) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isConforme = conformite.administrative && conformite.technique;

  if (isConforme) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Conforme
      </Badge>
    );
  }

  if (conformite.administrative === false || conformite.technique === false) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        Non conforme
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
      <AlertTriangle className="w-3 h-3 mr-1" />
      À vérifier
    </Badge>
  );
}

export default OffresTab;
