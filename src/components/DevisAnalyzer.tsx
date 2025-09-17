import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Building,
  Euro,
  Clock,
  Shield,
  Search,
  Calculator,
  Award,
  Users,
  Ban,
  Star,
  MapPin
} from 'lucide-react';
import { type DevisData, type EntrepriseData, type TorpAnalysisResult } from '@/types/torp';

interface DevisAnalyzerProps {
  onAnalysisComplete: (result: TorpAnalysisResult) => void;
}

const DevisAnalyzer: React.FC<DevisAnalyzerProps> = ({ onAnalysisComplete }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<TorpAnalysisResult | null>(null);

  const analysisSteps = [
    'Extraction des données du devis...',
    'Analyse de la structure entreprise...',
    'Vérification santé financière...',
    'Benchmark tarifaire marché...',
    'Détection anomalies & oublis...',
    'Calcul scoring global...',
    'Génération recommandations...'
  ];

  // Algorithme de scoring selon les spécifications (Phase 4)
  const simulateDevisAnalysis = async (devis: DevisData): Promise<TorpAnalysisResult> => {
    // Simulation de l'algorithme de fiabilité entreprise
    const calculateCompanyReliabilityScore = (entreprise: EntrepriseData) => {
      let score = 0;
      const risques: string[] = [];
      const benefices: string[] = [];

      // Santé financière (30 pts)
      if (entreprise.chiffreAffaires > 0) {
        score += 10;
      } else {
        risques.push('CA en baisse');
      }

      // Ancienneté & Expérience (20 pts)
      if (entreprise.age > 10) {
        score += 20;
        benefices.push('Entreprise expérimentée (+10 ans)');
      } else if (entreprise.age > 5) {
        score += 15;
      } else if (entreprise.age > 2) {
        score += 10;
      } else {
        score += 5;
        risques.push('Entreprise jeune (<2 ans)');
      }

      // Assurances (25 pts)
      if (entreprise.assurances.decennale) {
        score += 15;
        benefices.push('Décennale valide');
      } else {
        score -= 20;
        risques.push('Pas de décennale valide!');
      }

      if (entreprise.assurances.rcPro) {
        score += 10;
      }

      // Certifications (15 pts)
      if (entreprise.certification.includes('RGE')) {
        score += 10;
        benefices.push('Éligible aides État (RGE)');
      }

      if (entreprise.certification.includes('Qualibat')) {
        score += 5;
        benefices.push('Certification Qualibat');
      }

      // Réputation (10 pts)
      score += Math.min(entreprise.reputation * 2, 10);

      // Litiges
      if (entreprise.litiges > 0) {
        score -= entreprise.litiges * 5;
        risques.push(`${entreprise.litiges} litiges en cours`);
      }

      return {
        fiabilite: Math.min(Math.max(score, 0), 100),
        santeFinnaciere: 85,
        anciennete: entreprise.age > 10 ? 95 : 70,
        assurances: entreprise.assurances.decennale ? 95 : 0,
        certifications: entreprise.certification.length * 15,
        reputation: entreprise.reputation * 20,
        risques,
        benefices
      };
    };

    // Simulation analyse prix selon spécifications
    const analyzePricing = () => {
      const ecartMarcheSimule = -8; // 8% moins cher que la moyenne
      let prixScore = 270; // Score sur 300

      // Comparaison marché
      if (ecartMarcheSimule < -20) {
        prixScore = 300;
      } else if (ecartMarcheSimule >= -20 && ecartMarcheSimule < -10) {
        prixScore = 270;
      } else if (ecartMarcheSimule >= -10 && ecartMarcheSimule < 0) {
        prixScore = 240;
      } else if (ecartMarcheSimule >= 0 && ecartMarcheSimule < 10) {
        prixScore = 210;
      }

      return {
        vsMarche: ecartMarcheSimule,
        transparence: 85,
        coherence: 92,
        margeEstimee: 18,
        ajustementQualite: 5,
        economiesPotentielles: 3200
      };
    };

    const scoreEntreprise = calculateCompanyReliabilityScore(devis.entreprise);
    const scorePrix = analyzePricing();
    
    // Calcul score global selon algorithme spécifié
    const scoreGlobalCalcule = Math.min(
      (scoreEntreprise.fiabilite * 2.5 + // 250 points max
       270 + // prix score
       190 + // complétude (simulation)
       140 + // conformité (simulation)
       85) / 10, // délais (simulation)
      100
    );

    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    if (scoreGlobalCalcule >= 90) grade = 'A+';
    else if (scoreGlobalCalcule >= 80) grade = 'A';
    else if (scoreGlobalCalcule >= 70) grade = 'B';
    else if (scoreGlobalCalcule >= 60) grade = 'C';
    else if (scoreGlobalCalcule >= 50) grade = 'D';
    else grade = 'F';

    return {
      id: `analysis_${Date.now()}`,
      devisId: devis.id,
      scoreGlobal: Math.round(scoreGlobalCalcule),
      grade,
      
      scoreEntreprise,
      
      scorePrix,
      
      scoreCompletude: {
        elementsManquants: ['Étude de sol G2', 'Évacuation gravats'],
        incohérences: [],
        conformiteNormes: 92,
        risquesTechniques: ['Argile gonflante non mentionnée']
      },
      
      scoreConformite: {
        assurances: devis.entreprise.assurances.decennale,
        plu: true,
        normes: true,
        accessibilite: false,
        defauts: devis.entreprise.assurances.decennale ? [] : ['Décennale manquante']
      },
      
      scoreDelais: {
        realisme: 85,
        vsMarche: -5, // 5% plus rapide
        planningDetaille: true,
        penalitesRetard: false
      },
      
      recommandations: [
        {
          type: 'negociation',
          priorite: 'haute',
          titre: 'Négociation Main d\'œuvre',
          description: 'Main d\'œuvre facturée 22% au-dessus du marché',
          actionSuggeree: 'Demander décomposition détaillée des heures',
          impactBudget: -2500,
          delaiAction: 3
        },
        {
          type: 'verification',
          priorite: 'haute',
          titre: 'Coûts cachés identifiés',
          description: 'Évacuation gravats non chiffrée',
          actionSuggeree: 'Exiger devis complémentaire évacuation',
          impactBudget: 2100,
          delaiAction: 7
        },
        {
          type: 'protection',
          priorite: 'moyenne',
          titre: 'Sécurisation paiements',
          description: 'Utiliser le système séquestre TORP',
          actionSuggeree: 'Activer suivi paiements 30/40/30',
          delaiAction: 1
        }
      ],
      
      surcoutsDetectes: 3850,
      budgetRealEstime: 46350,
      margeNegociation: { min: 2500, max: 3500 },
      
      dateAnalyse: new Date(),
      dureeAnalyse: 2.3
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDevisFile(file);
    }
  };

  const startAnalysis = async () => {
    if (!devisFile) return;

    setIsAnalyzing(true);
    
    // Simulation progression analyse
    for (let i = 0; i < analysisSteps.length; i++) {
      setAnalysisStep(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Données simulées pour le devis
    const mockDevisData: DevisData = {
      id: `devis_${Date.now()}`,
      montant: 42500,
      entreprise: {
        siret: '12345678901234',
        nom: 'SAS BATIMENT DURAND',
        age: 12,
        chiffreAffaires: 850000,
        certification: ['RGE', 'Qualibat'],
        assurances: {
          decennale: true,
          rcPro: true,
          validite: '2025-12-31'
        },
        reputation: 4.2,
        litiges: 0
      },
      itemsDevis: [],
      completude: 85,
      conformite: 92
    };

    const result = await simulateDevisAnalysis(mockDevisData);
    setAnalysisResult(result);
    setIsAnalyzing(false);
    
    setTimeout(() => {
      onAnalysisComplete(result);
    }, 1000);
  };

  if (isAnalyzing) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            Analyse Intelligente du Devis en Cours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">
              {analysisSteps[analysisStep]}
            </h3>
            <Progress value={((analysisStep + 1) / analysisSteps.length) * 100} className="max-w-lg mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Analyse Entreprise</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {analysisStep >= 1 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Extraction SIRET & Infogreffe</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisStep >= 2 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Vérification santé financière</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisStep >= 2 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Contrôle assurances décennale</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Analyse Tarifaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {analysisStep >= 3 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Benchmark vs marché local</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisStep >= 4 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Détection anomalies prix</span>
                </div>
                <div className="flex items-center gap-2">
                  {analysisStep >= 4 ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span>Identification oublis</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-primary text-sm">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">
                Analyse basée sur 127 critères pondérés • Base de données 15,847 projets
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analysisResult) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Résultat Principal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Analyse TORP Complétée</CardTitle>
                  <p className="text-muted-foreground">
                    SAS BATIMENT DURAND • Devis 42,500€
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {analysisResult.scoreGlobal}/100
                </div>
                <Badge variant={
                  analysisResult.grade === 'A+' || analysisResult.grade === 'A' ? 'success' :
                  analysisResult.grade === 'B' ? 'warning' : 'destructive'
                } className="text-lg px-4 py-2">
                  Grade {analysisResult.grade}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Détails de l'analyse */}
        <Tabs defaultValue="synthese" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
            <TabsTrigger value="prix">Prix</TabsTrigger>
            <TabsTrigger value="technique">Technique</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="synthese" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Points forts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    Points Forts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisResult.scoreEntreprise.benefices.map((benefice, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      <span className="text-sm">{benefice}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span className="text-sm">Prix compétitif : {analysisResult.scorePrix.vsMarche}% vs marché</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span className="text-sm">Délais réalistes : {analysisResult.scoreDelais.vsMarche}% plus rapide</span>
                  </div>
                </CardContent>
              </Card>

              {/* Points d'attention */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                    Points d'Attention
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysisResult.scoreCompletude.elementsManquants.map((element, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      <span className="text-sm">{element} non chiffré</span>
                    </div>
                  ))}
                  {analysisResult.scoreCompletude.risquesTechniques.map((risque, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      <span className="text-sm">{risque}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Budget Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Analyse Financière
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">42,500€</div>
                    <div className="text-sm text-muted-foreground">Budget devis</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive mb-1">
                      +{analysisResult.surcoutsDetectes.toLocaleString()}€
                    </div>
                    <div className="text-sm text-muted-foreground">Coûts cachés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">
                      {analysisResult.budgetRealEstime.toLocaleString()}€
                    </div>
                    <div className="text-sm text-muted-foreground">Budget réel estimé</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success mb-1">
                      -{analysisResult.margeNegociation.max.toLocaleString()}€
                    </div>
                    <div className="text-sm text-muted-foreground">Marge négociation</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entreprise" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Analyse Structure Entreprise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Fiabilité Globale</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.fiabilite} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.fiabilite}/100</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Santé Financière</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.santeFinnaciere} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.santeFinnaciere}/100</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Assurances</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.assurances} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.assurances}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Ancienneté</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.anciennete} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.anciennete}/100</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Certifications</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.certifications} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.certifications}/100</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Réputation</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={analysisResult.scoreEntreprise.reputation} className="flex-1" />
                        <span className="font-bold">{analysisResult.scoreEntreprise.reputation}/100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-6">
            <div className="space-y-4">
              {analysisResult.recommandations.map((rec, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        rec.priorite === 'haute' ? 'bg-destructive/10 text-destructive' :
                        rec.priorite === 'moyenne' ? 'bg-warning/10 text-warning' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {rec.type === 'negociation' ? <Euro className="h-5 w-5" /> :
                         rec.type === 'verification' ? <Search className="h-5 w-5" /> :
                         rec.type === 'protection' ? <Shield className="h-5 w-5" /> :
                         <TrendingUp className="h-5 w-5" />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{rec.titre}</h3>
                          <Badge variant={rec.priorite === 'haute' ? 'destructive' : rec.priorite === 'moyenne' ? 'warning' : 'secondary'}>
                            {rec.priorite}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground mb-3">{rec.description}</p>
                        
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">Action suggérée :</p>
                          <p className="text-sm">{rec.actionSuggeree}</p>
                          
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            {rec.impactBudget && (
                              <div className={`flex items-center gap-1 ${rec.impactBudget < 0 ? 'text-success' : 'text-destructive'}`}>
                                <Euro className="h-3 w-3" />
                                <span>{rec.impactBudget < 0 ? '' : '+'}{rec.impactBudget.toLocaleString()}€</span>
                              </div>
                            )}
                            {rec.delaiAction && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{rec.delaiAction}j</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Analyse Intelligente du Devis
        </CardTitle>
        <p className="text-muted-foreground">
          Upload votre devis pour une analyse complète en 47 critères
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="devis-upload">Fichier devis (PDF, PNG, JPG)</Label>
            <Input
              id="devis-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          {devisFile && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Fichier prêt : {devisFile.name}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm">Notre IA analysera automatiquement :</h4>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Fiabilité entreprise (47 critères)</span>
            </div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span>Benchmark tarifaire marché</span>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <span>Détection anomalies & oublis</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Conformité réglementaire</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Réalisme des délais</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Recommandations personnalisées</span>
            </div>
          </div>
        </div>

        <Button 
          onClick={startAnalysis}
          disabled={!devisFile || isAnalyzing} 
          className="w-full" 
          size="lg"
        >
          <Search className="mr-2 h-5 w-5" />
          Lancer l'Analyse Complète (19,90€)
        </Button>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Analyse basée sur 15,847 projets • Économie moyenne : 4,250€
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DevisAnalyzer;