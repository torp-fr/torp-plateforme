/**
 * EntreprisesTab - Composant pour l'onglet Recherche Entreprises
 * Extrait de Phase1Consultation.tsx pour meilleure maintenabilité
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Building2, MapPin, Filter } from 'lucide-react';
import { EntrepriseCard } from '../EntrepriseCard';
import { EntrepriseService } from '@/services/phase1/entreprise.service';
import { useToast } from '@/hooks/use-toast';
import type { RecommandationEntreprise, Entreprise } from '@/types/phase1/entreprise.types';
import type { WorkLot } from '@/types/phase0/lot.types';
import type { UserType } from '@/types/user.types';

interface EntreprisesTabProps {
  projectId: string;
  lots: WorkLot[];
  location?: { lat: number; lng: number; address: string };
  userType: UserType;
  onEntrepriseSelect?: (entreprise: Entreprise, lotId?: string) => void;
}

interface SearchFilters {
  lotId: string | null;
  radius: number;
  minScore: number;
  rgeRequired: boolean;
  qualibatRequired: boolean;
}

export function EntreprisesTab({
  projectId,
  lots,
  location,
  userType,
  onEntrepriseSelect
}: EntreprisesTabProps) {
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [entreprises, setEntreprises] = useState<RecommandationEntreprise[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    lotId: null,
    radius: 50,
    minScore: 60,
    rgeRequired: false,
    qualibatRequired: true,
  });

  const handleSearch = useCallback(async () => {
    if (!location) {
      toast({
        title: 'Localisation requise',
        description: 'L\'adresse du chantier est nécessaire pour rechercher des entreprises',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const results = await EntrepriseService.findMatchingEntreprises(
        projectId,
        filters.lotId ? lots.filter(l => l.id === filters.lotId) : lots,
        {
          street: location.address,
          postalCode: '',
          city: '',
          coordinates: { lat: location.lat, lng: location.lng },
        },
        {
          radius: filters.radius,
          minScore: filters.minScore,
          rgeRequired: filters.rgeRequired,
          qualibatRequired: filters.qualibatRequired,
        }
      );

      setEntreprises(results);

      if (results.length === 0) {
        toast({
          title: 'Aucun résultat',
          description: 'Essayez d\'élargir vos critères de recherche',
        });
      } else {
        toast({
          title: `${results.length} entreprise(s) trouvée(s)`,
          description: 'Triées par score de compatibilité',
        });
      }
    } catch (error) {
      console.error('Erreur recherche entreprises:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de rechercher les entreprises',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }, [projectId, lots, location, filters, toast]);

  // Labels adaptés au profil
  const getLabels = () => {
    switch (userType) {
      case 'B2C':
        return {
          title: 'Trouver des artisans',
          description: 'Recherchez des professionnels qualifiés près de chez vous',
          searchBtn: 'Rechercher des artisans',
          noResults: 'Aucun artisan trouvé avec ces critères',
        };
      case 'B2B':
        return {
          title: 'Sous-traitants',
          description: 'Trouvez des sous-traitants qualifiés pour votre projet',
          searchBtn: 'Rechercher des sous-traitants',
          noResults: 'Aucun sous-traitant trouvé',
        };
      case 'B2G':
        return {
          title: 'Entreprises candidates',
          description: 'Liste des entreprises pouvant répondre à la consultation',
          searchBtn: 'Rechercher des entreprises',
          noResults: 'Aucune entreprise trouvée',
        };
      default:
        return {
          title: 'Entreprises',
          description: 'Recherche d\'entreprises',
          searchBtn: 'Rechercher',
          noResults: 'Aucun résultat',
        };
    }
  };

  const labels = getLabels();

  return (
    <div className="space-y-6">
      {/* Filtres de recherche */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>{labels.description}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sélection lot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lot de travaux</Label>
              <Select
                value={filters.lotId || 'all'}
                onValueChange={(v) => setFilters(f => ({ ...f, lotId: v === 'all' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les lots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les lots</SelectItem>
                  {lots.map(lot => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.category} - {lot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rayon de recherche: {filters.radius} km</Label>
              <Slider
                value={[filters.radius]}
                onValueChange={([v]) => setFilters(f => ({ ...f, radius: v }))}
                min={10}
                max={200}
                step={10}
              />
            </div>
          </div>

          {/* Filtres avancés */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Score minimum: {filters.minScore}/100</Label>
                <Slider
                  value={[filters.minScore]}
                  onValueChange={([v]) => setFilters(f => ({ ...f, minScore: v }))}
                  min={0}
                  max={100}
                  step={10}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="rge"
                  checked={filters.rgeRequired}
                  onCheckedChange={(v) => setFilters(f => ({ ...f, rgeRequired: v }))}
                />
                <Label htmlFor="rge">RGE obligatoire</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="qualibat"
                  checked={filters.qualibatRequired}
                  onCheckedChange={(v) => setFilters(f => ({ ...f, qualibatRequired: v }))}
                />
                <Label htmlFor="qualibat">Qualibat obligatoire</Label>
              </div>
            </div>
          )}

          {/* Bouton recherche */}
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                {labels.searchBtn}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Résultats */}
      {entreprises.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              {entreprises.length} entreprise{entreprises.length > 1 ? 's' : ''} trouvée{entreprises.length > 1 ? 's' : ''}
            </h3>
            <div className="text-sm text-muted-foreground">
              Triées par score de compatibilité
            </div>
          </div>

          <div className="grid gap-4">
            {entreprises.map((recommandation, index) => (
              <EntrepriseCard
                key={recommandation.entreprise.id}
                recommandation={recommandation}
                userType={userType}
                onConsult={(e) => onEntrepriseSelect?.(e)}
                onViewDetails={(e) => onEntrepriseSelect?.(e)}
                showDetails={index < 3}
              />
            ))}
          </div>
        </div>
      ) : !isSearching && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{labels.noResults}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Lancez une recherche pour trouver des entreprises qualifiées
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EntreprisesTab;
