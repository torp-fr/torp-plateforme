import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Home,
  AlertTriangle,
  CheckCircle,
  Calculator,
  FileText,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react';
import { useParcelAnalysis, ParcelAnalysisData, RiskAnalysisData } from '@/hooks/useParcelAnalysis';

interface ParcelAnalysisProps {
  onAnalysisComplete: (data: ParcelAnalysisData, risks: RiskAnalysisData) => void;
}

const ParcelAnalysis: React.FC<ParcelAnalysisProps> = ({ onAnalysisComplete }) => {
  const [address, setAddress] = useState('');
  const [analysisStarted, setAnalysisStarted] = useState(false);

  // Hook pour l'analyse réelle via APIs cadastre et géorisques
  const {
    parcelData,
    riskAnalysis,
    isLoading,
    isAnalyzing,
    analyzeParcelAsync,
    error,
  } = useParcelAnalysis({
    address: analysisStarted ? address : undefined,
    enabled: analysisStarted,
  });

  const analysisSteps = [
    'Géocodage de l\'adresse...',
    'Extraction données cadastrales IGN...',
    'Vérification PLU/POS...',
    'Analyse Géorisques (inondation, argiles, radon)...',
    'Calcul potentiel constructible...',
    'Génération rapport faisabilité...'
  ];

  // Effet pour callback quand l'analyse est terminée
  React.useEffect(() => {
    if (parcelData && riskAnalysis && !isLoading) {
      onAnalysisComplete(parcelData, riskAnalysis);
    }
  }, [parcelData, riskAnalysis, isLoading, onAnalysisComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      setAnalysisStarted(true);
      try {
        await analyzeParcelAsync(address);
      } catch {
        // Error handled by hook
      }
    }
  };

  if (isAnalyzing || isLoading) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Analyse Foncière & Cadastrale en Cours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">
              Analyse en cours...
            </h3>
            <Progress value={50} className="max-w-md mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">APIs Consultées (données réelles) :</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning animate-pulse" />
                  <span>api-adresse.data.gouv.fr</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning animate-pulse" />
                  <span>apicarto.ign.fr (Cadastre)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning animate-pulse" />
                  <span>Géorisques.gouv.fr</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Données Extraites :</h4>
              <div className="space-y-2 text-sm">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (parcelData && riskAnalysis) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Résumé Principal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Analyse de Parcelle Complétée</CardTitle>
                  <p className="text-muted-foreground">{address}</p>
                </div>
              </div>
              <Badge variant={riskAnalysis.score > 70 ? 'success' : riskAnalysis.score > 50 ? 'warning' : 'destructive'}>
                Score Faisabilité : {riskAnalysis.score}/100
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Grille Principale */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Potentiel Constructible */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Potentiel Constructible
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                <div className="text-success font-medium mb-2">✅ Constructibilité Confirmée</div>
                <p className="text-sm">
                  Il vous reste <strong>{parcelData.potentielConstructible.surfacePlancherDisponible} m²</strong> de 
                  surface plancher constructible sur votre parcelle de <strong>{parcelData.surfaceTotale} m²</strong> (zone {parcelData.zone}).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Surface totale</span>
                  <span className="font-medium">{parcelData.surfaceTotale} m²</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Existant</span>
                  <span className="font-medium">{parcelData.surfaceConstruiteExistante} m²</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Surface plancher max (COS {parcelData.cosMaximum})</span>
                  <span className="font-medium">{parcelData.potentielConstructible.surfacePlancherMax} m²</span>
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="font-semibold">Disponible</span>
                  <span className="font-bold text-success">{parcelData.potentielConstructible.surfacePlancherDisponible} m²</span>
                </div>
              </div>

              <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-warning text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Attention : emprise au sol limitée à {parcelData.potentielConstructible.emprisesolDisponible} m² supplémentaires</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contraintes Réglementaires */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contraintes PLU
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Zone</div>
                  <div className="font-medium">{parcelData.zone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Hauteur max</div>
                  <div className="font-medium">{parcelData.hauteurMax}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Retrait voirie</div>
                  <div className="font-medium">{parcelData.retraitVoirie}m minimum</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Retrait limites</div>
                  <div className="font-medium">{parcelData.retraitLimites}m minimum</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">COS maximum</div>
                  <div className="font-medium">{parcelData.cosMaximum}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">CES maximum</div>
                  <div className="font-medium">{parcelData.cesMaximum}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analyse des Risques */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Analyse des Risques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Zone inondable</span>
                  <Badge variant={riskAnalysis.zoneInondable === 'verte' ? 'success' : 'warning'}>
                    {riskAnalysis.zoneInondable}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Argile gonflante</span>
                  <Badge variant={riskAnalysis.argileGonflante === 'faible' ? 'success' : 'warning'}>
                    {riskAnalysis.argileGonflante}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Distance égouts</span>
                  <span className="font-medium">{riskAnalysis.distanceRaccordementEgout}m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Largeur accès</span>
                  <span className="font-medium">{riskAnalysis.largeurAcces}m</span>
                </div>
              </div>

              {riskAnalysis.alerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Alertes :</h4>
                  {riskAnalysis.alerts.map((alert, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm bg-warning/5 border border-warning/20 rounded p-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Surcoûts Identifiés */}
          {riskAnalysis.surcouts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Surcoûts Identifiés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskAnalysis.surcouts.map((surcout, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <span className="text-sm">{surcout.description}</span>
                      <span className="font-medium text-destructive">+{surcout.montant.toLocaleString()}€</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 font-semibold">
                    <span>Total surcoûts</span>
                    <span className="text-destructive">
                      +{riskAnalysis.surcouts.reduce((total, s) => total + s.montant, 0).toLocaleString()}€
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="text-sm text-destructive">
                    <strong>Impact budget :</strong> Ces surcoûts représentent environ 10-15% du budget total du projet.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Nouvelle analyse
          </Button>
          <Button size="lg">
            Continuer vers l'analyse de devis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Analyse Foncière & Cadastrale
        </CardTitle>
        <p className="text-muted-foreground">
          Vérification instantanée du potentiel constructible et des contraintes réglementaires
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="address">Adresse de la parcelle</Label>
            <Input
              id="address"
              type="text"
              placeholder="ex: 15 rue de la République, 75001 Paris"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              L'adresse permet de localiser précisément votre parcelle dans les bases de données officielles
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Cette analyse vérifiera automatiquement :</h4>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Zonage PLU/POS</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Coefficients COS/CES</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Contraintes de hauteur</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Retraits obligatoires</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Géorisques (inondation, sol)</span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span>Potentiel constructible</span>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={!address.trim()} className="w-full" size="lg">
            Lancer l'Analyse Gratuite (Valeur 847€)
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ParcelAnalysis;