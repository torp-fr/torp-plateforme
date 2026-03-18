/**
 * InfosEntreprisePappers Component
 * Affiche les informations enrichies d'une entreprise via Pappers
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { EnrichedEntrepriseData, HealthScore } from '@/services/api/pappers.service';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  Euro,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Award,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Info,
} from 'lucide-react';

interface InfosEntreprisePappersProps {
  siret?: string;
  siren?: string;
  /** Afficher en mode compact */
  compact?: boolean;
  /** Afficher automatiquement (sinon, bouton pour charger) */
  autoLoad?: boolean;
  /** Classe CSS additionnelle */
  className?: string;
}

// Composant pour afficher le score de santé
const HealthScoreDisplay = ({ healthScore }: { healthScore: HealthScore }) => {
  const getNiveauLabel = (niveau: HealthScore['niveau']) => {
    switch (niveau) {
      case 'excellent': return 'Excellente santé financière';
      case 'bon': return 'Bonne santé financière';
      case 'moyen': return 'Santé financière moyenne';
      case 'faible': return 'Santé financière fragile';
      default: return 'Non évaluée';
    }
  };

  return (
    <div className="space-y-4">
      {/* Score principal */}
      <div className="flex items-center gap-4">
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${healthScore.couleur}20` }}
        >
          <div
            className="absolute inset-2 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: healthScore.couleur }}
          >
            {healthScore.score}
          </div>
        </div>
        <div>
          <p className="font-semibold text-lg" style={{ color: healthScore.couleur }}>
            {getNiveauLabel(healthScore.niveau)}
          </p>
          <p className="text-sm text-muted-foreground">Score sur 100 points</p>
        </div>
      </div>

      {/* Détail des scores */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(healthScore.details).map(([key, detail]) => (
          <div key={key} className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground capitalize">
                {key === 'tendanceCA' ? 'Tendance CA' : key}
              </span>
              <span className="text-sm font-medium">{detail.score}/25</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(detail.score / 25) * 100}%`,
                  backgroundColor: healthScore.couleur,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={detail.label}>
              {detail.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Composant pour afficher la tendance CA
const TendanceIcon = ({ tendance }: { tendance: EnrichedEntrepriseData['tendanceCA'] }) => {
  switch (tendance) {
    case 'hausse':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'baisse':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
};

export const InfosEntreprisePappers = ({
  siret,
  siren,
  compact = false,
  autoLoad = true,
  className = '',
}: InfosEntreprisePappersProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EnrichedEntrepriseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [loaded, setLoaded] = useState(false);

  // Charger les données via Edge Function proxy
  const loadData = async () => {
    if (!siret && !siren) {
      setError('SIRET ou SIREN requis');
      return;
    }

    // Note: API key is managed server-side via Edge Function
    // No need to check client-side configuration

    try {
      setLoading(true);
      setError(null);

      if (!siret) {
        setError('Cette fonctionnalité nécessite un SIRET');
        setLoaded(true);
        return;
      }

      // Call Edge Function proxy instead of direct API
      const { supabase } = await import('@/lib/supabase');
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('pappers-proxy', {
        body: { siret },
      });

      if (proxyError) {
        console.error('[InfosEntreprisePappers] Edge Function error:', proxyError);
        setError('Erreur lors du chargement des données');
        setLoaded(true);
        return;
      }

      if (!proxyData) {
        setError('Entreprise non trouvée');
        setLoaded(true);
        return;
      }

      if (proxyData.error) {
        setError(proxyData.error);
        setLoaded(true);
        return;
      }

      // For now, disable direct display since we don't have EnrichedEntrepriseData transformation
      // In a real scenario, you'd map the proxyData to EnrichedEntrepriseData format
      log('[InfosEntreprisePappers] Pappers data retrieved successfully');
      setError('Données Pappers disponibles via API de proxy sécurisée. Affichage limité pour cette version.');
      setLoaded(true);
    } catch (err) {
      console.error('[InfosEntreprisePappers] Error:', err);
      setError('Erreur lors du chargement des données');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load si activé
  useEffect(() => {
    if (autoLoad && !loaded && (siret || siren)) {
      loadData();
    }
  }, [autoLoad, siret, siren]);

  // Si pas de SIRET/SIREN
  if (!siret && !siren) {
    return null;
  }

  // Bouton de chargement manuel
  if (!autoLoad && !loaded) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Enrichir avec les données Pappers
            </p>
            <Button onClick={loadData} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Charger les informations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`${className} border-amber-200 bg-amber-50/50`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700">Données non disponibles</p>
              <p className="text-sm text-amber-600 mt-1">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data
  if (!data) {
    return null;
  }

  // Render compact mode
  if (compact) {
    return (
      <Card className={className}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: data.healthScore.couleur }}
                  >
                    {data.healthScore.score}
                  </div>
                  <div>
                    <CardTitle className="text-base">{data.nom}</CardTitle>
                    <CardDescription>{data.formeJuridique} - {data.siret}</CardDescription>
                  </div>
                </div>
                {expanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {renderFullContent(data)}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Render full mode
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {data.nom}
            </CardTitle>
            <CardDescription className="mt-1">
              {data.formeJuridique} - SIRET: {data.siret}
            </CardDescription>
          </div>
          <Badge variant={data.estActive ? 'default' : 'destructive'}>
            {data.estActive ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Inactive
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {renderFullContent(data)}
      </CardContent>
    </Card>
  );
};

// Fonction helper pour le contenu complet
function renderFullContent(data: EnrichedEntrepriseData) {
  return (
    <div className="space-y-6">
      {/* Score de santé financière */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Score de santé financière
        </h4>
        <HealthScoreDisplay healthScore={data.healthScore} />
      </div>

      {/* Informations clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Ancienneté</span>
          </div>
          <p className="font-semibold">{data.ancienneteAnnees} ans</p>
          <p className="text-xs text-muted-foreground">
            Créée le {new Date(data.dateCreation).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Euro className="h-4 w-4" />
            <span className="text-xs">Capital</span>
          </div>
          <p className="font-semibold">
            {data.capital > 0 ? `${data.capital.toLocaleString('fr-FR')} €` : 'Non renseigné'}
          </p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Chiffre d'affaires</span>
          </div>
          <p className="font-semibold flex items-center gap-1">
            {data.chiffreAffaires !== null
              ? `${(data.chiffreAffaires / 1000).toLocaleString('fr-FR')}k €`
              : 'Non disponible'}
            <TendanceIcon tendance={data.tendanceCA} />
          </p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Effectif</span>
          </div>
          <p className="font-semibold">
            {data.effectif !== null ? `${data.effectif} salariés` : 'Non renseigné'}
          </p>
        </div>
      </div>

      {/* Adresse */}
      <div className="flex items-start gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p>{data.adresse.ligne1}</p>
          <p>{data.adresse.codePostal} {data.adresse.ville}</p>
        </div>
      </div>

      {/* Activité */}
      <div className="text-sm">
        <span className="text-muted-foreground">Activité: </span>
        <span>{data.libelleNAF}</span>
        <span className="text-muted-foreground ml-2">(NAF {data.codeNAF})</span>
      </div>

      {/* Dirigeants */}
      {data.dirigeants.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-sm">Dirigeants</h4>
          <div className="space-y-1">
            {data.dirigeants.slice(0, 3).map((dir, idx) => (
              <p key={idx} className="text-sm text-muted-foreground">
                {dir.prenom} {dir.nom} - <span className="italic">{dir.fonction}</span>
              </p>
            ))}
            {data.dirigeants.length > 3 && (
              <p className="text-xs text-muted-foreground">
                + {data.dirigeants.length - 3} autre(s)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Certifications RGE */}
      {data.certificationsRGE.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
            <Award className="h-4 w-4 text-green-600" />
            Certifications RGE
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.certificationsRGE.map((cert, idx) => (
              <Badge key={idx} variant="secondary" className="bg-green-100 text-green-700">
                {cert.nom}
                <span className="text-xs ml-1 opacity-70">({cert.validite})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {data.labels.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-sm">Labels & Certificats</h4>
          <div className="flex flex-wrap gap-2">
            {data.labels.map((label, idx) => (
              <Badge key={idx} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Données fournies par Pappers.fr
      </p>
    </div>
  );
}

export default InfosEntreprisePappers;
