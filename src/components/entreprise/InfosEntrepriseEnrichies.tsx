import { useState, useEffect } from 'react';
import { entrepriseUnifiedService, EntrepriseUnifiee } from '@/services/entreprise/entreprise-unified.service';
import { EntrepriseCard } from '@/components/entreprise/EntrepriseCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface Props {
  siret?: string | null;
  siren?: string | null;
  // Données déjà extraites de l'analyse (optionnel)
  entrepriseAnalyse?: {
    nom?: string;
    siret?: string;
    adresse?: string;
  };
  // Options d'affichage
  showFinances?: boolean;
  showLabels?: boolean;
  showDirigeants?: boolean;
  compact?: boolean;
}

export function InfosEntrepriseEnrichies({
  siret,
  siren,
  entrepriseAnalyse,
  showFinances = true,
  showLabels = true,
  showDirigeants = false,
  compact = false,
}: Props) {
  const [entreprise, setEntreprise] = useState<EntrepriseUnifiee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identifier = siret || siren;
    if (identifier) {
      loadEntreprise(identifier);
    }
  }, [siret, siren]);

  async function loadEntreprise(identifier: string) {
    setLoading(true);
    setError(null);

    try {
      const result = await entrepriseUnifiedService.getEntreprise(identifier, {
        enrichirFinances: showFinances,
        enrichirLabels: showLabels,
        enrichirScoring: true,
        enrichirProcedures: true,
      });

      if (result.success && result.data) {
        setEntreprise(result.data);
      } else {
        setError(result.error || 'Impossible de récupérer les informations');
      }
    } catch (err) {
      setError('Erreur lors de la récupération des données');
    } finally {
      setLoading(false);
    }
  }

  // Vérifier si au moins une API est configurée
  const status = entrepriseUnifiedService.getStatus();

  if (!status.anyConfigured) {
    // Afficher les données de l'analyse seulement
    if (entrepriseAnalyse) {
      return (
        <div className="p-4 bg-muted rounded-lg">
          <p className="font-medium">{entrepriseAnalyse.nom || 'Entreprise non identifiée'}</p>
          {entrepriseAnalyse.siret && (
            <p className="text-sm text-muted-foreground">SIRET : {entrepriseAnalyse.siret}</p>
          )}
          {entrepriseAnalyse.adresse && (
            <p className="text-sm text-muted-foreground">{entrepriseAnalyse.adresse}</p>
          )}
        </div>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!entreprise) {
    // Si pas de données chargées mais pas d'erreur, afficher les données de l'analyse
    if (entrepriseAnalyse) {
      return (
        <div className="p-4 bg-muted rounded-lg">
          <p className="font-medium">{entrepriseAnalyse.nom || 'Entreprise non identifiée'}</p>
          {entrepriseAnalyse.siret && (
            <p className="text-sm text-muted-foreground">SIRET : {entrepriseAnalyse.siret}</p>
          )}
          {entrepriseAnalyse.adresse && (
            <p className="text-sm text-muted-foreground">{entrepriseAnalyse.adresse}</p>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <EntrepriseCard
      entreprise={entreprise}
      showFinances={showFinances}
      showLabels={showLabels}
      showDirigeants={showDirigeants}
      compact={compact}
    />
  );
}

export default InfosEntrepriseEnrichies;
