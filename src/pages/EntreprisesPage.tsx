/**
 * EntreprisesPage
 * Page de recherche d'entreprises du BTP
 * Permet de rechercher et filtrer des entreprises par SIRET, nom, activité, localisation
 * Utilise les APIs Sirene et Pappers pour l'enrichissement
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { sireneService } from '@/services/api/sirene.service';
import { SiretLookupService } from '@/services/company/siret-lookup.service';
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
  CheckCircle2,
  Calendar,
  Hash,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface SearchFilters {
  query: string;
  localisation: string;
  rge: boolean;
  qualibat: boolean;
}

interface EntrepriseResult {
  id?: string;
  siret: string;
  siren?: string;
  denomination: string;
  adresse_siege?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  activite_principale?: string;
  code_naf?: string;
  specialites?: string[];
  effectif?: number | string;
  date_creation?: string;
  certifications?: any[];
  qualifications?: any[];
  score_torp?: number;
  forme_juridique?: string;
  estActif?: boolean;
  source?: 'database' | 'api' | 'sirene' | 'pappers';
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
  const [searchMode, setSearchMode] = useState<'siret' | 'nom'>('nom');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Détecter si la requête ressemble à un SIRET
  const isSiretQuery = (query: string): boolean => {
    const cleaned = query.replace(/\s/g, '');
    return /^\d{14}$/.test(cleaned);
  };

  // Détecter si la requête ressemble à un SIREN
  const isSirenQuery = (query: string): boolean => {
    const cleaned = query.replace(/\s/g, '');
    return /^\d{9}$/.test(cleaned) && !/^\d{14}$/.test(cleaned);
  };

  // Recherche par SIRET via les APIs externes
  const searchBySiret = async (siret: string): Promise<EntrepriseResult[]> => {
    const cleanedSiret = siret.replace(/\s/g, '');
    console.log('[EntreprisesPage] Recherche SIRET via APIs:', cleanedSiret);

    try {
      // 1. D'abord vérifier dans la base locale
      const { data: localData } = await supabase
        .from('companies')
        .select('*')
        .eq('siret', cleanedSiret)
        .single();

      if (localData) {
        console.log('[EntreprisesPage] Entreprise trouvée en base locale');
        return [{
          ...localData,
          denomination: localData.denomination || 'Entreprise',
          source: 'database' as const,
        }];
      }

      // 2. Rechercher via API Sirene
      console.log('[EntreprisesPage] Recherche via API Sirene...');
      const sireneResult = await sireneService.getEtablissementBySiret(cleanedSiret);

      if (sireneResult.success && sireneResult.data) {
        console.log('[EntreprisesPage] Entreprise trouvée via Sirene:', sireneResult.data.raisonSociale);
        return [{
          siret: sireneResult.data.siret,
          siren: sireneResult.data.siren,
          denomination: sireneResult.data.raisonSociale || 'Entreprise',
          forme_juridique: sireneResult.data.categorieJuridiqueLibelle || undefined,
          code_naf: sireneResult.data.codeNAF || undefined,
          activite_principale: sireneResult.data.libelleNAF || undefined,
          adresse_siege: sireneResult.data.adresseComplete,
          code_postal: sireneResult.data.adresse.codePostal || undefined,
          ville: sireneResult.data.adresse.commune || undefined,
          effectif: sireneResult.data.trancheEffectifLibelle || undefined,
          date_creation: sireneResult.data.dateCreationFormatee || undefined,
          estActif: sireneResult.data.estActif,
          source: 'sirene' as const,
        }];
      }

      // 3. Fallback vers SiretLookupService (inclut Pappers)
      console.log('[EntreprisesPage] Fallback vers SiretLookupService...');
      try {
        const lookupResult = await SiretLookupService.lookupBySiret(cleanedSiret);
        console.log('[EntreprisesPage] Entreprise trouvée via Lookup:', lookupResult.raisonSociale);
        return [{
          siret: lookupResult.siret,
          siren: lookupResult.siren,
          denomination: lookupResult.raisonSociale,
          forme_juridique: lookupResult.formeJuridique || undefined,
          code_naf: lookupResult.codeApe || undefined,
          activite_principale: lookupResult.libelleApe || undefined,
          adresse_siege: lookupResult.adresse?.complete || undefined,
          code_postal: lookupResult.adresse?.codePostal || undefined,
          ville: lookupResult.adresse?.ville || undefined,
          effectif: lookupResult.effectif || undefined,
          date_creation: lookupResult.dateCreation || undefined,
          estActif: lookupResult.estActif,
          source: 'pappers' as const,
        }];
      } catch (lookupError: any) {
        console.error('[EntreprisesPage] Lookup error:', lookupError);
        if (lookupError.code === 'NOT_FOUND') {
          return [];
        }
        throw lookupError;
      }
    } catch (err) {
      console.error('[EntreprisesPage] SIRET search error:', err);
      throw err;
    }
  };

  // Recherche par nom via l'API publique
  const searchByName = async (query: string, localisation?: string): Promise<EntrepriseResult[]> => {
    console.log('[EntreprisesPage] Recherche par nom:', query, 'localisation:', localisation);
    const results: EntrepriseResult[] = [];

    // 1. Rechercher dans la base locale
    try {
      let dbQuery = supabase
        .from('companies')
        .select('*')
        .order('score_torp', { ascending: false, nullsFirst: false })
        .limit(20);

      if (query) {
        dbQuery = dbQuery.or(`denomination.ilike.%${query}%,activite_principale.ilike.%${query}%`);
      }

      if (localisation) {
        dbQuery = dbQuery.or(`ville.ilike.%${localisation}%,code_postal.ilike.${localisation}%`);
      }

      const { data: localData } = await dbQuery;
      if (localData && localData.length > 0) {
        console.log('[EntreprisesPage] Trouvé', localData.length, 'résultats en base locale');
        results.push(...localData.map(r => ({
          ...r,
          denomination: r.denomination || 'Entreprise',
          source: 'database' as const,
        })));
      }
    } catch (err) {
      console.warn('[EntreprisesPage] Erreur recherche base locale:', err);
    }

    // 2. Rechercher via API publique
    try {
      let searchQuery = query;
      if (localisation) {
        searchQuery = `${query} ${localisation}`.trim();
      }

      console.log('[EntreprisesPage] Recherche via API publique:', searchQuery);
      const apiResults = await SiretLookupService.searchByName(searchQuery, 30);

      if (apiResults && apiResults.length > 0) {
        console.log('[EntreprisesPage] Trouvé', apiResults.length, 'résultats via API');

        // Filtrer les doublons (par SIRET)
        const existingSirets = new Set(results.map(r => r.siret));

        for (const r of apiResults) {
          if (r.siret && !existingSirets.has(r.siret)) {
            results.push({
              siret: r.siret,
              siren: r.siren,
              denomination: r.raisonSociale,
              code_naf: r.codeApe || undefined,
              activite_principale: r.libelleApe || undefined,
              code_postal: r.adresse?.codePostal || undefined,
              ville: r.adresse?.ville || undefined,
              effectif: r.effectif || undefined,
              date_creation: r.dateCreation || undefined,
              estActif: r.estActif,
              source: 'api' as const,
            });
            existingSirets.add(r.siret);
          }
        }
      }
    } catch (err) {
      console.warn('[EntreprisesPage] Erreur recherche API:', err);
    }

    return results;
  };

  const handleSearch = async () => {
    const query = filters.query.trim();
    const localisation = filters.localisation.trim();

    if (!query && !localisation) {
      setError('Veuillez saisir un terme de recherche ou une localisation');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      let searchResults: EntrepriseResult[] = [];

      // Détection automatique du type de recherche
      if (isSiretQuery(query)) {
        console.log('[EntreprisesPage] Détection SIRET, recherche spécifique');
        searchResults = await searchBySiret(query);
      } else if (isSirenQuery(query)) {
        console.log('[EntreprisesPage] Détection SIREN, recherche par nom');
        searchResults = await searchByName(query, localisation);
      } else {
        searchResults = await searchByName(query, localisation);
      }

      // Appliquer les filtres RGE/Qualibat
      if (filters.rge) {
        searchResults = searchResults.filter(e =>
          e.certifications?.some((c: any) => c.type === 'RGE') ||
          e.source !== 'database' // Garder les résultats API car on ne peut pas filtrer
        );
      }

      setResults(searchResults);
    } catch (err: any) {
      console.error('[EntreprisesPage] Search error:', err);
      if (err.code === 'INVALID_SIRET') {
        setError('Format SIRET invalide. Le SIRET doit contenir 14 chiffres.');
      } else if (err.code === 'NOT_FOUND') {
        setError('Aucune entreprise trouvée avec ce SIRET. Si l\'entreprise a été créée récemment (moins de 2 mois), elle peut ne pas encore être référencée dans les bases officielles.');
        setResults([]);
      } else if (err.code === 'API_ERROR') {
        setError('Erreur de connexion aux API. Veuillez réessayer dans quelques instants.');
      } else {
        setError('Une erreur s\'est produite lors de la recherche. Veuillez réessayer.');
      }
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Sauvegarder une entreprise dans la base de données
  const saveToDatabase = async (entreprise: EntrepriseResult) => {
    if (!entreprise.siret) return;

    setSavingId(entreprise.siret);

    try {
      const companyData = {
        siret: entreprise.siret,
        siren: entreprise.siren || entreprise.siret.substring(0, 9),
        denomination: entreprise.denomination,
        forme_juridique: entreprise.forme_juridique,
        code_naf: entreprise.code_naf,
        activite_principale: entreprise.activite_principale,
        adresse_siege: entreprise.adresse_siege,
        code_postal: entreprise.code_postal,
        ville: entreprise.ville,
        departement: entreprise.code_postal?.substring(0, 2),
        effectif: typeof entreprise.effectif === 'number' ? entreprise.effectif : null,
        date_creation: entreprise.date_creation,
        specialites: [],
        zones_intervention: [],
        qualifications: [],
        certifications: [],
        verified: false,
        last_enriched_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('companies')
        .upsert(companyData, { onConflict: 'siret' })
        .select()
        .single();

      if (error) {
        console.error('[EntreprisesPage] Save error:', error);
        throw error;
      }

      console.log('[EntreprisesPage] Entreprise sauvegardée:', data.id);

      // Mettre à jour le résultat local
      setResults(prev => prev.map(r =>
        r.siret === entreprise.siret
          ? { ...r, id: data.id, source: 'database' as const }
          : r
      ));
    } catch (err) {
      console.error('[EntreprisesPage] Save failed:', err);
    } finally {
      setSavingId(null);
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

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'database':
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Base TORP</Badge>;
      case 'sirene':
        return <Badge variant="outline" className="text-xs bg-green-50 text-green-700">API Sirene</Badge>;
      case 'pappers':
        return <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">Pappers</Badge>;
      case 'api':
        return <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">API</Badge>;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Trouver des entreprises</h1>
          <p className="text-muted-foreground">
            Recherchez des entreprises par SIRET, nom, activité ou localisation
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
            <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'siret' | 'nom')}>
              <TabsList className="mb-4">
                <TabsTrigger value="siret" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Par SIRET
                </TabsTrigger>
                <TabsTrigger value="nom" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Par Nom / Activité
                </TabsTrigger>
              </TabsList>

              <TabsContent value="siret" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siret-query">Numéro SIRET</Label>
                  <Input
                    id="siret-query"
                    placeholder="Ex: 12345678901234"
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                    onKeyPress={handleKeyPress}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Entrez les 14 chiffres du SIRET pour une recherche exacte
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="nom" className="space-y-4">
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
              </TabsContent>
            </Tabs>

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
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
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
                    Vérifiez le numéro SIRET ou essayez avec d'autres termes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {results.map((entreprise, index) => (
                  <Card key={entreprise.siret || index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Nom et badges */}
                          <div className="flex items-start gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">
                              {entreprise.denomination || 'Entreprise'}
                            </h3>
                            {entreprise.estActif === false && (
                              <Badge variant="destructive">Cessée</Badge>
                            )}
                            {entreprise.estActif === true && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            )}
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
                            {getSourceBadge(entreprise.source)}
                          </div>

                          {/* SIRET */}
                          {entreprise.siret && (
                            <p className="text-sm font-mono text-muted-foreground mt-1">
                              SIRET: {SiretLookupService.formatSiret(entreprise.siret)}
                            </p>
                          )}

                          {/* Forme juridique et NAF */}
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                            {entreprise.forme_juridique && (
                              <span>{entreprise.forme_juridique}</span>
                            )}
                            {entreprise.code_naf && (
                              <span>• NAF: {entreprise.code_naf}</span>
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
                                {entreprise.effectif}
                              </span>
                            )}
                            {entreprise.date_creation && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Créée le {entreprise.date_creation}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 sm:items-end">
                          {entreprise.source !== 'database' && entreprise.siret && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveToDatabase(entreprise)}
                              disabled={savingId === entreprise.siret}
                            >
                              {savingId === entreprise.siret ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Enregistrement...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ajouter à la base
                                </>
                              )}
                            </Button>
                          )}
                          {entreprise.source === 'database' && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Dans la base TORP
                            </Badge>
                          )}
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
                Recherchez des entreprises du BTP françaises.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Utilisez un numéro SIRET pour une recherche exacte, ou recherchez par nom/activité.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Les données proviennent des APIs officielles Sirene (INSEE) et Pappers.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
