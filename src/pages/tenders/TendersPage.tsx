/**
 * Page de gestion des appels d'offres (MOA)
 * Liste tous les AO créés par l'utilisateur
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, Search, Filter, Eye, Edit, Send, Clock,
  Briefcase, AlertTriangle, Loader2, MapPin, Euro, Calendar,
  Users, Download, FileText, CheckCircle2, XCircle
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TenderService } from '@/services/tender/tender.service';
import type { TenderListItem, TenderStatus, TenderFilter } from '@/types/tender';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<TenderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  ready: { label: 'Prêt', variant: 'outline' },
  published: { label: 'Publié', variant: 'default' },
  closed: { label: 'Fermé', variant: 'secondary' },
  evaluation: { label: 'Évaluation', variant: 'outline' },
  attributed: { label: 'Attribué', variant: 'default' },
  cancelled: { label: 'Annulé', variant: 'destructive' },
  archived: { label: 'Archivé', variant: 'secondary' },
};

export function TendersPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [filteredTenders, setFilteredTenders] = useState<TenderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Charger les AO
  useEffect(() => {
    const loadTenders = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await TenderService.listByUser(user.id);
        setTenders(data);
        setFilteredTenders(data);
      } catch (err) {
        console.error('Erreur chargement AO:', err);
        setError('Impossible de charger les appels d\'offres');
      } finally {
        setIsLoading(false);
      }
    };

    loadTenders();
  }, [user?.id]);

  // Appliquer les filtres
  useEffect(() => {
    let filtered = [...tenders];

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
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

    setFilteredTenders(filtered);
  }, [tenders, statusFilter, searchQuery]);

  // Statistiques
  const stats = {
    total: tenders.length,
    draft: tenders.filter(t => t.status === 'draft' || t.status === 'ready').length,
    published: tenders.filter(t => t.status === 'published').length,
    responses: tenders.reduce((acc, t) => acc + t.responsesCount, 0),
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
            <Link to="/phase0/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Mes projets
            </Link>
          </Button>
          <Button asChild>
            <Link to="/phase0/new">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau projet
            </Link>
          </Button>
        </div>

        {/* Titre */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mes Appels d'Offres</h1>
          <p className="text-muted-foreground">
            Gérez vos consultations et suivez les réponses des entreprises
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-muted-foreground">Total AO</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Edit className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.draft}</div>
                  <div className="text-sm text-muted-foreground">En préparation</div>
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
                  <div className="text-2xl font-bold">{stats.published}</div>
                  <div className="text-sm text-muted-foreground">Publiés</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.responses}</div>
                  <div className="text-sm text-muted-foreground">Réponses reçues</div>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="ready">Prêt à publier</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                  <SelectItem value="evaluation">En évaluation</SelectItem>
                  <SelectItem value="attributed">Attribué</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des AO */}
        {filteredTenders.length > 0 ? (
          <div className="space-y-4">
            {filteredTenders.map((tender) => (
              <Card
                key={tender.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/tenders/${tender.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {tender.reference}
                        </Badge>
                        <Badge variant={STATUS_CONFIG[tender.status]?.variant || 'secondary'}>
                          {STATUS_CONFIG[tender.status]?.label || tender.status}
                        </Badge>
                        {tender.responseDeadline && new Date(tender.responseDeadline) < new Date() && tender.status === 'published' && (
                          <Badge variant="destructive">Expiré</Badge>
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

                    <div className="flex items-center gap-4 ml-4">
                      {/* Compteur de réponses */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{tender.responsesCount}</div>
                        <div className="text-xs text-muted-foreground">Réponses</div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tenders/${tender.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || statusFilter !== 'all'
                  ? 'Aucun appel d\'offres trouvé'
                  : 'Aucun appel d\'offres'}
              </h3>
              <p className="text-muted-foreground mb-6 text-center">
                {searchQuery || statusFilter !== 'all'
                  ? 'Modifiez vos filtres pour voir plus de résultats'
                  : 'Créez votre premier projet pour générer un appel d\'offres'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button asChild>
                  <Link to="/phase0/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un projet
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default TendersPage;
