/**
 * EntreprisesPage
 * Page de recherche d'entreprises du BTP
 * Permet de rechercher et filtrer des entreprises par activité, localisation, certifications
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import {
  Search,
  Building2,
  MapPin,
  Users,
  Award,
  Shield,
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  AlertCircle,
} from 'lucide-react';

interface SearchFilters {
  query: string;
  localisation: string;
  rge: boolean;
  qualibat: boolean;
}

interface EntrepriseResult {
  id: string;
  siret: string;
  denomination: string;
  adresse_siege?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  activite_principale?: string;
  specialites: string[];
  effectif?: number;
  certifications: any[];
  qualifications: any[];
  score_torp?: number;
}

export default function EntreprisesPage() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    localisation: '',
    rge: false,
    qualibat: false,
  });
  const [results, setResults] = useState<EntrepriseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!filters.query && !filters.localisation) {
      setError('Veuillez saisir un terme de recherche ou une localisation');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      let query = supabase
        .from('companies')
        .select('*')
        .order('score_torp', { ascending: false, nullsFirst: false })
        .limit(50);

      // Recherche par nom/activité
      if (filters.query) {
        query = query.or(`denomination.ilike.%${filters.query}%,activite_principale.ilike.%${filters.query}%`);
      }

      // Filtre par localisation
      if (filters.localisation) {
        query = query.or(`ville.ilike.%${filters.localisation}%,code_postal.ilike.${filters.localisation}%,departement.eq.${filters.localisation.substring(0, 2)}`);
      }

      // Filtre RGE
      if (filters.rge) {
        query = query.contains('certifications', [{ type: 'RGE' }]);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error('[EntreprisesPage] Search error:', queryError);
        setError('Erreur lors de la recherche. Veuillez réessayer.');
        setResults([]);
      } else {
        setResults(data || []);
      }
    } catch (err) {
      console.error('[EntreprisesPage] Unexpected error:', err);
      setError('Une erreur inattendue s\'est produite.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const hasRGE = (entreprise: EntrepriseResult): boolean => {
    return entreprise.certifications?.some((c: any) => c.type === 'RGE') || false;
  };

  const hasQualibat = (entreprise: EntrepriseResult): boolean => {
    return entreprise.qualifications?.some((q: any) =>
      q.organisme?.toLowerCase().includes('qualibat')
    ) || false;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Trouver des entreprises</h1>
          <p className="text-muted-foreground">
            Recherchez des entreprises du BTP par activité, localisation ou certifications
          </p>
        </div>

        {/* Filtres de recherche */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Rechercher
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="query">Nom ou activité</Label>
                <Input
                  id="query"
                  placeholder="Ex: plomberie, électricité, SARL Martin..."
                  value={filters.query}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localisation">Localisation</Label>
                <Input
                  id="localisation"
                  placeholder="Ville ou code postal"
                  value={filters.localisation}
                  onChange={(e) => setFilters({ ...filters, localisation: e.target.value })}
                  onKeyPress={handleKeyPress}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rge"
                  checked={filters.rge}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, rge: checked === true })
                  }
                />
                <Label htmlFor="rge" className="flex items-center gap-1 cursor-pointer">
                  <Shield className="h-4 w-4 text-green-600" />
                  Certifié RGE
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="qualibat"
                  checked={filters.qualibat}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, qualibat: checked === true })
                  }
                />
                <Label htmlFor="qualibat" className="flex items-center gap-1 cursor-pointer">
                  <Award className="h-4 w-4 text-blue-600" />
                  Qualibat
                </Label>
              </div>
            </div>

            <Button onClick={handleSearch} disabled={isSearching} className="w-full sm:w-auto">
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Rechercher
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Message d'erreur */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Résultats */}
        {hasSearched && !error && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {results.length} entreprise{results.length !== 1 ? 's' : ''} trouvée{results.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {results.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Aucune entreprise ne correspond à vos critères de recherche.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Essayez d'élargir vos critères ou de modifier les filtres.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {results.map((entreprise) => (
                  <Card key={entreprise.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Nom et badges */}
                          <div className="flex items-start gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">
                              {entreprise.denomination || 'Entreprise'}
                            </h3>
                            {hasRGE(entreprise) && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Shield className="h-3 w-3 mr-1" />
                                RGE
                              </Badge>
                            )}
                            {hasQualibat(entreprise) && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Award className="h-3 w-3 mr-1" />
                                Qualibat
                              </Badge>
                            )}
                            {entreprise.score_torp && entreprise.score_torp >= 70 && (
                              <Badge className="bg-primary">
                                Score {entreprise.score_torp}/100
                              </Badge>
                            )}
                          </div>

                          {/* Activité */}
                          {entreprise.activite_principale && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {entreprise.activite_principale}
                            </p>
                          )}

                          {/* Spécialités */}
                          {entreprise.specialites && entreprise.specialites.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entreprise.specialites.slice(0, 5).map((spec, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {spec}
                                </Badge>
                              ))}
                              {entreprise.specialites.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{entreprise.specialites.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Infos complémentaires */}
                          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                            {(entreprise.ville || entreprise.code_postal) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {entreprise.ville}{entreprise.code_postal && ` (${entreprise.code_postal})`}
                              </span>
                            )}
                            {entreprise.effectif && (
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {entreprise.effectif} employés
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 sm:items-end">
                          {entreprise.telephone && (
                            <a
                              href={`tel:${entreprise.telephone}`}
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Phone className="h-4 w-4" />
                              {entreprise.telephone}
                            </a>
                          )}
                          {entreprise.email && (
                            <a
                              href={`mailto:${entreprise.email}`}
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Mail className="h-4 w-4" />
                              Contacter
                            </a>
                          )}
                          {entreprise.site_web && (
                            <a
                              href={entreprise.site_web.startsWith('http') ? entreprise.site_web : `https://${entreprise.site_web}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Site web
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* État initial */}
        {!hasSearched && !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Utilisez les filtres ci-dessus pour rechercher des entreprises du BTP.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Vous pouvez filtrer par nom, activité, localisation ou certifications (RGE, Qualibat).
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
