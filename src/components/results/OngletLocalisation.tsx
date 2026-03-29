import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  MapPin,
  Navigation,
  Building2,
  Home,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Compass,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import {
  geocodingService,
  GeocodingResult,
  DistanceResult,
  GeoZone,
} from '@/services/api/geocoding.service';

interface OngletLocalisationProps {
  entrepriseAdresse?: string | null;
  chantierAdresse?: string | null;
  entrepriseNom?: string;
  className?: string;
}

interface GeoData {
  entreprise?: GeocodingResult;
  chantier?: GeocodingResult;
  distance?: DistanceResult;
  geoZone?: GeoZone;
}

export function OngletLocalisation({
  entrepriseAdresse,
  chantierAdresse,
  entrepriseNom,
  className,
}: OngletLocalisationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<GeoData>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  // Charger les données de géocodage
  const loadGeoData = async () => {
    if (!entrepriseAdresse && !chantierAdresse) {
      setError('Aucune adresse disponible pour le géocodage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data: GeoData = {};

      // Géocoder l'adresse entreprise
      if (entrepriseAdresse) {
        log('[OngletLocalisation] Géocodage entreprise:', entrepriseAdresse);
        const result = await geocodingService.geocode(entrepriseAdresse, { limit: 1 });
        if (result.success && result.bestMatch) {
          data.entreprise = result.bestMatch;
        }
      }

      // Géocoder l'adresse chantier
      if (chantierAdresse) {
        log('[OngletLocalisation] Géocodage chantier:', chantierAdresse);
        const result = await geocodingService.geocode(chantierAdresse, { limit: 1 });
        if (result.success && result.bestMatch) {
          data.chantier = result.bestMatch;

          // Récupérer la zone géographique
          if (result.bestMatch.postcode) {
            const zoneResult = geocodingService.getGeoZone(result.bestMatch.postcode);
            if (zoneResult.success && zoneResult.data) {
              data.geoZone = zoneResult.data;
            }
          }
        }
      }

      // Calculer la distance si les deux adresses sont géocodées
      if (data.entreprise && data.chantier && entrepriseAdresse && chantierAdresse) {
        log('[OngletLocalisation] Calcul distance');
        const distanceResult = await geocodingService.calculateDistance(
          entrepriseAdresse,
          chantierAdresse
        );
        if (distanceResult.success && distanceResult.data) {
          data.distance = distanceResult.data;
        }
      }

      setGeoData(data);
      setHasLoaded(true);
    } catch (err) {
      console.error('[OngletLocalisation] Erreur:', err);
      setError('Erreur lors du géocodage des adresses');
    } finally {
      setLoading(false);
    }
  };

  // Charger automatiquement au montage si des adresses sont disponibles
  useEffect(() => {
    if ((entrepriseAdresse || chantierAdresse) && !hasLoaded) {
      loadGeoData();
    }
  }, [entrepriseAdresse, chantierAdresse, hasLoaded]);

  // Fonction pour obtenir la couleur de la zone
  const getZoneColor = (zoneType?: string) => {
    switch (zoneType) {
      case 'proximite':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'locale':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'regionale':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'nationale':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Message de zone
  const getZoneMessage = (zoneType?: string) => {
    switch (zoneType) {
      case 'proximite':
        return 'Entreprise très proche du chantier - intervention rapide possible';
      case 'locale':
        return 'Entreprise dans la zone locale - bon compromis réactivité/coût';
      case 'regionale':
        return 'Entreprise régionale - prévoir des frais de déplacement';
      case 'nationale':
        return 'Entreprise éloignée - frais de déplacement significatifs possibles';
      default:
        return '';
    }
  };

  // Si pas d'adresses du tout
  if (!entrepriseAdresse && !chantierAdresse) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Localisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Adresses non disponibles</AlertTitle>
            <AlertDescription>
              Les adresses de l'entreprise et du chantier n'ont pas été détectées dans le devis.
              Ces informations permettent de calculer la distance et d'évaluer la zone d'intervention.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Localisation
          </CardTitle>
          <CardDescription>Analyse des adresses en cours...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Localisation & Distance
            </CardTitle>
            <CardDescription>
              Analyse géographique entreprise/chantier via l'API BAN
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadGeoData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Distance principale */}
        {geoData.distance && (
          <Card className={cn(
            "border-2",
            getZoneColor(geoData.distance.zone?.type)
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className={cn(
                  "flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center",
                  getZoneColor(geoData.distance.zone?.type)
                )}>
                  <Navigation className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-bold">
                      {geoData.distance.distanceFormatee}
                    </span>
                    <Badge className={getZoneColor(geoData.distance.zone?.type)}>
                      {geoData.distance.zone?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {geoData.distance.dureeEstimee} (estimé)
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      ~{geoData.distance.estimatedRoadDistanceKm} km par la route
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {getZoneMessage(geoData.distance.zone?.type)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cartes adresses */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Adresse Entreprise */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Adresse Entreprise
              </CardTitle>
            </CardHeader>
            <CardContent>
              {geoData.entreprise ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                    <div>
                      <p className="font-medium">{entrepriseNom || 'Entreprise'}</p>
                      <p className="text-sm text-muted-foreground">
                        {geoData.entreprise.label}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Code postal</span>
                      <p className="font-medium">{geoData.entreprise.postcode}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Ville</span>
                      <p className="font-medium">{geoData.entreprise.city}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Département</span>
                      <p className="font-medium">{geoData.entreprise.departement || geoData.entreprise.departementCode}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Score BAN</span>
                      <p className="font-medium">{Math.round((geoData.entreprise.score || 0) * 100)}%</p>
                    </div>
                  </div>
                  {geoData.entreprise.coordinates && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Compass className="h-3 w-3" />
                      GPS: {geoData.entreprise.coordinates.lat.toFixed(5)}, {geoData.entreprise.coordinates.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              ) : entrepriseAdresse ? (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1" />
                  <div>
                    <p className="text-sm">Adresse non géocodée</p>
                    <p className="text-xs">{entrepriseAdresse}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Adresse entreprise non disponible
                </p>
              )}
            </CardContent>
          </Card>

          {/* Adresse Chantier */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4 text-green-500" />
                Adresse Chantier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {geoData.chantier ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                    <div>
                      <p className="font-medium">Lieu d'intervention</p>
                      <p className="text-sm text-muted-foreground">
                        {geoData.chantier.label}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Code postal</span>
                      <p className="font-medium">{geoData.chantier.postcode}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Ville</span>
                      <p className="font-medium">{geoData.chantier.city}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Département</span>
                      <p className="font-medium">{geoData.chantier.departement || geoData.chantier.departementCode}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Score BAN</span>
                      <p className="font-medium">{Math.round((geoData.chantier.score || 0) * 100)}%</p>
                    </div>
                  </div>
                  {geoData.chantier.coordinates && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Compass className="h-3 w-3" />
                      GPS: {geoData.chantier.coordinates.lat.toFixed(5)}, {geoData.chantier.coordinates.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              ) : chantierAdresse ? (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1" />
                  <div>
                    <p className="text-sm">Adresse non géocodée</p>
                    <p className="text-xs">{chantierAdresse}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Adresse chantier non disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Zone géographique et coefficient */}
        {geoData.geoZone && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="h-4 w-4" />
                Zone Géographique & Coefficient Prix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Département</p>
                  <p className="font-bold text-lg">{geoData.geoZone.departmentCode}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Région</p>
                  <p className="font-bold text-lg">{geoData.geoZone.regionCode || '-'}</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Type de zone</p>
                  <Badge variant={geoData.geoZone.isUrban ? 'default' : 'secondary'}>
                    {geoData.geoZone.isUrban ? 'Urbaine' : 'Rurale'}
                  </Badge>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Coef. prix BTP</p>
                  <p className={cn(
                    "font-bold text-lg",
                    geoData.geoZone.priceCoefficient > 1.1 ? 'text-orange-600' :
                    geoData.geoZone.priceCoefficient > 1 ? 'text-yellow-600' : 'text-green-600'
                  )}>
                    x{geoData.geoZone.priceCoefficient.toFixed(2)}
                  </p>
                </div>
              </div>
              {geoData.geoZone.priceCoefficient > 1 && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Le coefficient de prix de {geoData.geoZone.priceCoefficient.toFixed(2)} indique que
                    les prix BTP dans cette zone sont en moyenne{' '}
                    <strong>{Math.round((geoData.geoZone.priceCoefficient - 1) * 100)}% plus élevés</strong>{' '}
                    que la moyenne nationale.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info API BAN */}
        <div className="text-xs text-muted-foreground flex items-center gap-2 justify-end">
          <Info className="h-3 w-3" />
          Données géographiques via API Géoplateforme IGN (Base Adresse Nationale)
        </div>
      </CardContent>
    </Card>
  );
}

export default OngletLocalisation;
