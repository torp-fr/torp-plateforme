/**
 * Compare Page
 * Page de comparaison multi-devis pour les utilisateurs B2C
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { comparisonService, DevisComparable, ComparisonResult } from '@/services/comparison/comparison.service';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Scale,
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  FileText,
  Building2,
  Euro,
  Star,
} from 'lucide-react';

type Step = 'selection' | 'comparing' | 'results';

// Composant pour afficher le grade avec couleur
const GradeBadge = ({ grade }: { grade: string }) => {
  const getGradeColor = (g: string) => {
    switch (g) {
      case 'A+': return 'bg-emerald-500 text-white';
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-lime-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'F': return 'bg-red-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${getGradeColor(grade)}`}>
      {grade}
    </span>
  );
};

// Composant carte de devis pour la sélection
const DevisCard = ({
  devis,
  selected,
  onToggle,
  disabled,
}: {
  devis: DevisComparable;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) => {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        selected ? 'ring-2 ring-primary border-primary' : ''
      } ${disabled && !selected ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
      onClick={() => !disabled && onToggle()}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            disabled={disabled && !selected}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium truncate">{devis.nomProjet}</h3>
              <GradeBadge grade={devis.grade} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Building2 className="h-3 w-3" />
              {devis.entreprise}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-semibold text-primary">
                {devis.montant.toLocaleString('fr-FR')} €
              </span>
              <span className="text-sm text-muted-foreground">
                Score: {devis.scoreTotal}/1000
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant pour afficher un score comparatif
const ScoreBar = ({
  label,
  scores,
  maxScore,
  devisIds,
  winnerId,
}: {
  label: string;
  scores: number[];
  maxScore: number;
  devisIds: string[];
  winnerId?: string;
}) => {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">/ {maxScore}</span>
      </div>
      <div className="space-y-1">
        {scores.map((score, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-16 text-xs text-muted-foreground truncate">
              Devis {idx + 1}
            </div>
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[idx]} transition-all duration-500`}
                style={{ width: `${(score / maxScore) * 100}%` }}
              />
            </div>
            <div className="w-12 text-sm text-right font-medium">
              {score}
              {devisIds[idx] === winnerId && (
                <Trophy className="inline h-3 w-3 ml-1 text-yellow-500" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Compare() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('selection');
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [availableDevis, setAvailableDevis] = useState<DevisComparable[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  // Charger les devis analysés
  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    const loadDevis = async () => {
      try {
        setLoading(true);
        const devis = await comparisonService.getAnalyzedDevisForUser(user.id);
        setAvailableDevis(devis);
      } catch (error) {
        console.error('[Compare] Error loading devis:', error);
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Impossible de charger vos devis analysés.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadDevis();
  }, [user?.id, navigate, toast]);

  // Toggle sélection d'un devis
  const toggleDevis = (devisId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(devisId)) {
        return prev.filter(id => id !== devisId);
      }
      if (prev.length >= 3) {
        toast({
          title: 'Maximum atteint',
          description: 'Vous pouvez comparer jusqu\'à 3 devis maximum.',
        });
        return prev;
      }
      return [...prev, devisId];
    });
  };

  // Lancer la comparaison
  const startComparison = async () => {
    if (selectedIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Sélection insuffisante',
        description: 'Sélectionnez au moins 2 devis pour comparer.',
      });
      return;
    }

    try {
      setStep('comparing');
      setComparing(true);

      const comparisonResult = await comparisonService.createComparison(user!.id, {
        devisIds: selectedIds,
      });

      setResult(comparisonResult);
      setStep('results');
    } catch (error) {
      console.error('[Compare] Error creating comparison:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer la comparaison.',
      });
      setStep('selection');
    } finally {
      setComparing(false);
    }
  };

  // Obtenir le devis gagnant
  const getWinnerDevis = () => {
    if (!result) return null;
    return result.devis.find(d => d.id === result.winner.id);
  };

  // Render step: Selection
  const renderSelection = () => (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <Scale className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Comparer vos devis</h1>
        <p className="text-muted-foreground">
          Sélectionnez 2 à 3 devis analysés pour les comparer côte à côte
          et découvrir notre recommandation.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : availableDevis.length < 2 ? (
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">Pas assez de devis</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Vous avez besoin d'au moins 2 devis analysés pour les comparer.
              Vous en avez actuellement {availableDevis.length}.
            </p>
            <Button onClick={() => navigate('/analyze')}>
              <FileText className="h-4 w-4 mr-2" />
              Analyser un devis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} / 3 devis sélectionnés
            </p>
            <Badge variant={selectedIds.length >= 2 ? 'default' : 'secondary'}>
              {selectedIds.length >= 2 ? 'Prêt à comparer' : 'Sélectionnez au moins 2 devis'}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableDevis.map(devis => (
              <DevisCard
                key={devis.id}
                devis={devis}
                selected={selectedIds.includes(devis.id)}
                onToggle={() => toggleDevis(devis.id)}
                disabled={selectedIds.length >= 3 && !selectedIds.includes(devis.id)}
              />
            ))}
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={startComparison}
              disabled={selectedIds.length < 2}
            >
              Comparer les devis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Render step: Comparing (loading)
  const renderComparing = () => (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h2 className="text-xl font-semibold mb-2">Analyse en cours...</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Nous comparons vos {selectedIds.length} devis selon les 5 axes TORP
        pour vous fournir une recommandation objective.
      </p>
    </div>
  );

  // Render step: Results
  const renderResults = () => {
    if (!result) return null;

    const winner = getWinnerDevis();

    return (
      <div className="space-y-8">
        {/* Header avec recommandation */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Notre recommandation</h2>
                <p className="text-lg font-medium text-primary mb-2">
                  {winner?.entreprise}
                </p>
                <p className="text-muted-foreground">
                  {result.winner.raison}
                </p>
              </div>
              {winner && (
                <div className="text-right">
                  <GradeBadge grade={winner.grade} />
                  <p className="text-lg font-bold mt-2">
                    {winner.montant.toLocaleString('fr-FR')} €
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tableau comparatif */}
        <Card>
          <CardHeader>
            <CardTitle>Comparaison détaillée</CardTitle>
            <CardDescription>
              Analyse côte à côte de vos {result.devis.length} devis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Critère</th>
                    {result.devis.map((d, idx) => (
                      <th key={d.id} className="text-center py-3 px-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-medium">{d.entreprise}</span>
                          {d.id === result.winner.id && (
                            <Badge variant="default" className="text-xs">
                              <Trophy className="h-3 w-3 mr-1" />
                              Recommandé
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">Score TORP</td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <GradeBadge grade={d.grade} />
                          <span className="font-bold">{d.scoreTotal}/1000</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">
                      <Euro className="inline h-4 w-4 mr-1" />
                      Montant
                    </td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        <span className={`font-bold ${d.id === result.analyse.meilleurPrix ? 'text-green-600' : ''}`}>
                          {d.montant.toLocaleString('fr-FR')} €
                          {d.id === result.analyse.meilleurPrix && (
                            <TrendingDown className="inline h-4 w-4 ml-1 text-green-600" />
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">
                      <Building2 className="inline h-4 w-4 mr-1" />
                      Entreprise
                    </td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        {d.scoreEntreprise}/250
                        {d.id === result.analyse.meilleureEntreprise && (
                          <Star className="inline h-4 w-4 ml-1 text-yellow-500" />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">Prix vs Marché</td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        {d.scorePrix}/300
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">Complétude</td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        {d.scoreCompletude}/200
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">Conformité</td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        {d.scoreConformite}/150
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-2 font-medium">Délais</td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        {d.scoreDelais}/100
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-2 font-medium text-orange-600">
                      <AlertCircle className="inline h-4 w-4 mr-1" />
                      Surcoûts détectés
                    </td>
                    {result.devis.map(d => (
                      <td key={d.id} className="text-center py-3 px-2">
                        <span className={d.surcoutsDetectes > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                          {d.surcoutsDetectes > 0 ? `${d.surcoutsDetectes.toLocaleString('fr-FR')} €` : 'Aucun'}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Analyse graphique */}
        <Card>
          <CardHeader>
            <CardTitle>Analyse visuelle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScoreBar
              label="Score Global"
              scores={result.devis.map(d => d.scoreTotal)}
              maxScore={1000}
              devisIds={result.devis.map(d => d.id)}
              winnerId={result.analyse.meilleurScore}
            />
            <ScoreBar
              label="Entreprise"
              scores={result.devis.map(d => d.scoreEntreprise)}
              maxScore={250}
              devisIds={result.devis.map(d => d.id)}
              winnerId={result.analyse.meilleureEntreprise}
            />
            <ScoreBar
              label="Prix"
              scores={result.devis.map(d => d.scorePrix)}
              maxScore={300}
              devisIds={result.devis.map(d => d.id)}
            />
          </CardContent>
        </Card>

        {/* Écart de prix */}
        {result.analyse.ecartPrix > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">Écart de prix entre les devis</h3>
                  <p className="text-2xl font-bold text-primary">
                    {result.analyse.ecartPrix.toLocaleString('fr-FR')} €
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      ({result.analyse.ecartPrixPourcentage}% de différence)
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => {
            setStep('selection');
            setSelectedIds([]);
            setResult(null);
          }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Nouvelle comparaison
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Retour au dashboard
          </Button>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {step === 'selection' && renderSelection()}
        {step === 'comparing' && renderComparing()}
        {step === 'results' && renderResults()}
      </div>
    </AppLayout>
  );
}
