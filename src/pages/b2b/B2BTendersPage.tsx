/**
 * Page des appels d'offres disponibles (B2B Entreprise)
 * Permet aux entreprises de consulter et répondre aux AO
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Search, Filter, Eye, FileText, Clock, Send,
  Briefcase, AlertTriangle, Loader2, MapPin, Euro, Calendar,
  Building, Download, CheckCircle2, Star, TrendingUp, Zap
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TenderService } from '@/services/tender/tender.service';
import { MatchingService } from '@/services/tender/matching.service';
import { ResponseService } from '@/services/tender/response.service';
import type { TenderListItem, TenderFilter } from '@/types/tender';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

export function B2BTendersPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [allTenders, setAllTenders] = useState<TenderListItem[]>([]);
  const [matchedTenders, setMatchedTenders] = useState<TenderListItem[]>([]);
  const [myResponses, setMyResponses] = useState<{ tenderId: string; status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('recommended');

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [lotFilter, setLotFilter] = useState<string>('all');

  // Charger les AO
  useEffect(() => {
    const loadTenders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Charger tous les AO publiés
        const publicTenders = await TenderService.listPublic({
          status: ['published'],
        });
        setAllTenders(publicTenders);

        // Charger les AO recommandés (matching)
        if (user?.id) {
          try {
            const companyProfile = await MatchingService.getCompanyProfile(user.id);
            if (companyProfile) {
              const matched = await MatchingService.findMatchingTenders(companyProfile);
              setMatchedTenders(matched.map(m => m.tender as unknown as TenderListItem));
            }
          } catch (matchErr) {
            console.log('Pas de profil entreprise pour le matching');
          }

          // Charger mes réponses
          try {
            const responses = await ResponseService.listByCompany(user.id);
            setMyResponses(responses.map(r => ({ tenderId: r.tenderId, status: r.status })));
          } catch (respErr) {
            console.log('Pas de réponses');
          }
        }
      } catch (err) {
        console.error('Erreur chargement AO:', err);
        setError('Impossible de charger les appels d\'offres');
      } finally {
        setIsLoading(false);
      }
    };

    loadTenders();
  }, [user?.id]);

  // Filtrer les AO
  const getFilteredTenders = useCallback((tenders: TenderListItem[]) => {
    let filtered = [...tenders];

    // Filtre par département
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(t =>
        t.workPostalCode?.startsWith(departmentFilter)
      );
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.reference.toLowerCase().includes(query) ||
        t.workCity?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [departmentFilter, searchQuery]);

  // Vérifier si déjà répondu
  const hasResponded = (tenderId: string) => {
    return myResponses.some(r => r.tenderId === tenderId);
  };

  const getResponseStatus = (tenderId: string) => {
    return myResponses.find(r => r.tenderId === tenderId)?.status;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to="/pro">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tableau de bord
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/b2b/responses">
              <FileText className="w-4 h-4 mr-2" />
              Mes réponses
            </Link>
          </Button>
        </div>

        {/* Titre */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Appels d'Offres</h1>
          <p className="text-muted-foreground">
            Consultez les consultations en cours et positionnez-vous pour remporter des marchés
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistiques rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{allTenders.length}</div>
                  <div className="text-sm text-muted-foreground">AO disponibles</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{matchedTenders.length}</div>
                  <div className="text-sm text-muted-foreground">Recommandés</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{myResponses.length}</div>
                  <div className="text-sm text-muted-foreground">Mes réponses</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {myResponses.filter(r => r.status === 'selected').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Marchés gagnés</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par titre, référence ou ville..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <MapPin className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les départements</SelectItem>
                  <SelectItem value="75">75 - Paris</SelectItem>
                  <SelectItem value="92">92 - Hauts-de-Seine</SelectItem>
                  <SelectItem value="93">93 - Seine-Saint-Denis</SelectItem>
                  <SelectItem value="94">94 - Val-de-Marne</SelectItem>
                  <SelectItem value="77">77 - Seine-et-Marne</SelectItem>
                  <SelectItem value="78">78 - Yvelines</SelectItem>
                  <SelectItem value="91">91 - Essonne</SelectItem>
                  <SelectItem value="95">95 - Val-d'Oise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={lotFilter} onValueChange={setLotFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type de lot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les lots</SelectItem>
                  <SelectItem value="platrerie">Plâtrerie</SelectItem>
                  <SelectItem value="electricite">Électricité</SelectItem>
                  <SelectItem value="plomberie">Plomberie</SelectItem>
                  <SelectItem value="peinture">Peinture</SelectItem>
                  <SelectItem value="carrelage">Carrelage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="recommended" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Recommandés
              {matchedTenders.length > 0 && (
                <Badge variant="secondary" className="ml-1">{matchedTenders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Tous les AO
              <Badge variant="secondary" className="ml-1">{allTenders.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* AO Recommandés */}
          <TabsContent value="recommended" className="space-y-4">
            {matchedTenders.length > 0 ? (
              <>
                <Alert className="border-yellow-500/50 bg-yellow-500/5">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <AlertDescription>
                    Ces appels d'offres correspondent à votre profil et vos compétences.
                    Le score de matching indique votre adéquation avec le marché.
                  </AlertDescription>
                </Alert>

                {getFilteredTenders(matchedTenders).map((tender) => (
                  <TenderCard
                    key={tender.id}
                    tender={tender}
                    hasResponded={hasResponded(tender.id)}
                    responseStatus={getResponseStatus(tender.id)}
                    isRecommended
                    onViewClick={() => navigate(`/b2b/ao/${tender.id}`)}
                  />
                ))}
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Star className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune recommandation</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Complétez votre profil entreprise pour recevoir des recommandations
                    personnalisées d'appels d'offres correspondant à vos compétences.
                  </p>
                  <Button variant="outline" className="mt-4" asChild>
                    <Link to="/pro/settings">
                      <Building className="w-4 h-4 mr-2" />
                      Compléter mon profil
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tous les AO */}
          <TabsContent value="all" className="space-y-4">
            {getFilteredTenders(allTenders).length > 0 ? (
              getFilteredTenders(allTenders).map((tender) => (
                <TenderCard
                  key={tender.id}
                  tender={tender}
                  hasResponded={hasResponded(tender.id)}
                  responseStatus={getResponseStatus(tender.id)}
                  onViewClick={() => navigate(`/b2b/ao/${tender.id}`)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery || departmentFilter !== 'all'
                      ? 'Aucun appel d\'offres trouvé'
                      : 'Aucun appel d\'offres disponible'}
                  </h3>
                  <p className="text-muted-foreground text-center">
                    {searchQuery || departmentFilter !== 'all'
                      ? 'Modifiez vos filtres pour voir plus de résultats'
                      : 'Revenez bientôt pour consulter les nouvelles consultations'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Composant TenderCard
interface TenderCardProps {
  tender: TenderListItem;
  hasResponded: boolean;
  responseStatus?: string;
  isRecommended?: boolean;
  onViewClick: () => void;
}

function TenderCard({ tender, hasResponded, responseStatus, isRecommended, onViewClick }: TenderCardProps) {
  const isExpired = tender.responseDeadline && new Date(tender.responseDeadline) < new Date();
  const daysLeft = tender.responseDeadline
    ? Math.ceil((new Date(tender.responseDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${
        isRecommended ? 'border-yellow-500/30 bg-yellow-500/5' : ''
      }`}
      onClick={onViewClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs">
                {tender.reference}
              </Badge>
              {isRecommended && (
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                  <Star className="w-3 h-3 mr-1" />
                  Recommandé
                </Badge>
              )}
              {hasResponded && (
                <Badge variant={
                  responseStatus === 'submitted' ? 'default' :
                  responseStatus === 'selected' ? 'default' :
                  responseStatus === 'rejected' ? 'destructive' : 'secondary'
                }>
                  {responseStatus === 'draft' && 'Brouillon'}
                  {responseStatus === 'submitted' && 'Réponse envoyée'}
                  {responseStatus === 'selected' && 'Retenu'}
                  {responseStatus === 'rejected' && 'Non retenu'}
                  {responseStatus === 'shortlisted' && 'Présélectionné'}
                </Badge>
              )}
              {isExpired && (
                <Badge variant="destructive">Expiré</Badge>
              )}
              {!isExpired && daysLeft !== null && daysLeft <= 7 && (
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  <Clock className="w-3 h-3 mr-1" />
                  J-{daysLeft}
                </Badge>
              )}
            </div>

            <h3 className="text-lg font-semibold mb-2">{tender.title}</h3>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {tender.workCity && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {tender.workPostalCode} {tender.workCity}
                </div>
              )}
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {tender.lotsCount} lot(s)
              </div>
              {(tender.estimatedBudgetMin || tender.estimatedBudgetMax) && (
                <div className="flex items-center gap-1">
                  <Euro className="w-4 h-4" />
                  {tender.estimatedBudgetMin?.toLocaleString('fr-FR')} € - {tender.estimatedBudgetMax?.toLocaleString('fr-FR')} €
                </div>
              )}
              {tender.responseDeadline && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Limite: {new Date(tender.responseDeadline).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            {!hasResponded && !isExpired ? (
              <Button onClick={(e) => { e.stopPropagation(); onViewClick(); }}>
                <Eye className="w-4 h-4 mr-2" />
                Consulter
              </Button>
            ) : (
              <Button variant="outline" onClick={(e) => { e.stopPropagation(); onViewClick(); }}>
                <Eye className="w-4 h-4 mr-2" />
                Voir
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default B2BTendersPage;
