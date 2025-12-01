/**
 * TORP B2B - Liste complète des Analyses
 * @route /pro/analyses
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  FileText,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Analysis {
  id: string;
  reference_devis: string;
  nom_projet: string | null;
  montant_ttc: number | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  score_total: number | null;
  grade: string | null;
  created_at: string;
  ticket_torp_reference: string | null;
  version: number;
}

interface Stats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  avgScore: number;
  gradeDistribution: Record<string, number>;
}

const STATUS_LABELS = {
  PENDING: { label: 'En attente', color: 'bg-gray-100 text-gray-800' },
  PROCESSING: { label: 'Analyse en cours', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Terminée', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Échec', color: 'bg-red-100 text-red-800' },
};

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-emerald-500 text-white',
  'A': 'bg-green-500 text-white',
  'B': 'bg-lime-500 text-white',
  'C': 'bg-yellow-500 text-white',
  'D': 'bg-orange-500 text-white',
  'E': 'bg-red-500 text-white',
  'F': 'bg-red-700 text-white',
};

export default function ProAnalysesList() {
  const navigate = useNavigate();
  const { userType, user } = useApp();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
      return;
    }
    loadAnalyses();
  }, [userType, navigate, user]);

  useEffect(() => {
    applyFilters();
  }, [analyses, searchQuery, statusFilter, gradeFilter, sortBy]);

  const loadAnalyses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Récupérer toutes les analyses de l'entreprise
      const { data: companyProfile } = await supabase
        .from('pro_company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!companyProfile) {
        setError('Profil entreprise introuvable');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('pro_devis_analyses')
        .select('*')
        .eq('company_id', companyProfile.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAnalyses(data || []);
      calculateStats(data || []);
    } catch (err) {
      console.error('Erreur chargement analyses:', err);
      setError('Impossible de charger les analyses');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Analysis[]) => {
    const total = data.length;
    const completed = data.filter((a) => a.status === 'COMPLETED').length;
    const pending = data.filter((a) => a.status === 'PENDING').length;
    const failed = data.filter((a) => a.status === 'FAILED').length;

    const completedAnalyses = data.filter((a) => a.status === 'COMPLETED' && a.score_total);
    const avgScore =
      completedAnalyses.length > 0
        ? Math.round(
            completedAnalyses.reduce((sum, a) => sum + (a.score_total || 0), 0) /
              completedAnalyses.length
          )
        : 0;

    const gradeDistribution: Record<string, number> = {};
    data.forEach((a) => {
      if (a.grade) {
        gradeDistribution[a.grade] = (gradeDistribution[a.grade] || 0) + 1;
      }
    });

    setStats({ total, completed, pending, failed, avgScore, gradeDistribution });
  };

  const applyFilters = () => {
    let filtered = [...analyses];

    // Recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.reference_devis.toLowerCase().includes(query) ||
          a.nom_projet?.toLowerCase().includes(query) ||
          a.ticket_torp_reference?.toLowerCase().includes(query)
      );
    }

    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    // Filtre par grade
    if (gradeFilter !== 'all') {
      filtered = filtered.filter((a) => a.grade === gradeFilter);
    }

    // Tri
    switch (sortBy) {
      case 'date_desc':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'score_desc':
        filtered.sort((a, b) => (b.score_total || 0) - (a.score_total || 0));
        break;
      case 'score_asc':
        filtered.sort((a, b) => (a.score_total || 0) - (b.score_total || 0));
        break;
      case 'montant_desc':
        filtered.sort((a, b) => (b.montant_ttc || 0) - (a.montant_ttc || 0));
        break;
      case 'montant_asc':
        filtered.sort((a, b) => (a.montant_ttc || 0) - (b.montant_ttc || 0));
        break;
    }

    setFilteredAnalyses(filtered);
  };

  const exportToCSV = () => {
    const headers = [
      'Référence',
      'Projet',
      'Statut',
      'Score',
      'Grade',
      'Montant TTC',
      'Ticket TORP',
      'Date création',
      'Version',
    ];

    const rows = filteredAnalyses.map((a) => [
      a.reference_devis,
      a.nom_projet || 'Non renseigné',
      STATUS_LABELS[a.status].label,
      a.score_total ? `${a.score_total}/1000` : 'Non disponible',
      a.grade || 'Non disponible',
      a.montant_ttc ? `${a.montant_ttc.toFixed(2)}€` : 'Non renseigné',
      a.ticket_torp_reference || 'Non généré',
      new Date(a.created_at).toLocaleDateString('fr-FR'),
      `v${a.version}`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analyses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des analyses...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pro/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au dashboard
        </Button>

        {/* En-tête et statistiques */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Toutes mes analyses</h1>
              <p className="text-muted-foreground">
                Gérez et consultez l'ensemble de vos analyses de devis
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportToCSV} variant="outline" disabled={filteredAnalyses.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
              <Button onClick={() => navigate('/pro/new-analysis')}>
                <FileText className="w-4 h-4 mr-2" />
                Nouvelle analyse
              </Button>
            </div>
          </div>

          {/* Statistiques */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total analyses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Terminées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    En attente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Score moyen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.avgScore}
                    <span className="text-sm text-muted-foreground">/1000</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Taux de réussite
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-600">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Filtres et recherche */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par référence, projet, ticket..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="PENDING">En attente</SelectItem>
                  <SelectItem value="PROCESSING">En cours</SelectItem>
                  <SelectItem value="COMPLETED">Terminées</SelectItem>
                  <SelectItem value="FAILED">Échec</SelectItem>
                </SelectContent>
              </Select>

              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les grades</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Date (récent)</SelectItem>
                  <SelectItem value="date_asc">Date (ancien)</SelectItem>
                  <SelectItem value="score_desc">Score (élevé)</SelectItem>
                  <SelectItem value="score_asc">Score (faible)</SelectItem>
                  <SelectItem value="montant_desc">Montant (élevé)</SelectItem>
                  <SelectItem value="montant_asc">Montant (faible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des analyses */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredAnalyses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune analyse trouvée</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== 'all' || gradeFilter !== 'all'
                    ? 'Aucune analyse ne correspond à vos critères de recherche'
                    : "Vous n'avez pas encore créé d'analyse de devis"}
                </p>
                <Button onClick={() => navigate('/pro/new-analysis')}>
                  Créer ma première analyse
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAnalyses.map((analysis) => (
              <Card
                key={analysis.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/pro/analysis/${analysis.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{analysis.reference_devis}</h3>
                        <Badge className={STATUS_LABELS[analysis.status].color}>
                          {STATUS_LABELS[analysis.status].label}
                        </Badge>
                        {analysis.grade && (
                          <Badge className={GRADE_COLORS[analysis.grade] || 'bg-gray-500 text-white'}>
                            {analysis.grade}
                          </Badge>
                        )}
                        {analysis.version > 1 && (
                          <Badge variant="outline">v{analysis.version}</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Projet</p>
                          <p className="font-medium">{analysis.nom_projet || 'Non renseigné'}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Score TORP</p>
                          <p className="font-medium">
                            {analysis.score_total ? (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                {analysis.score_total}/1000
                              </span>
                            ) : (
                              'Non disponible'
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Montant TTC</p>
                          <p className="font-medium">
                            {analysis.montant_ttc
                              ? `${analysis.montant_ttc.toFixed(2)} €`
                              : 'Non renseigné'}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Créé
                          </p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(analysis.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>

                      {analysis.ticket_torp_reference && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            Ticket TORP : <span className="font-mono font-medium">{analysis.ticket_torp_reference}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination info */}
        {filteredAnalyses.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {filteredAnalyses.length} analyse{filteredAnalyses.length > 1 ? 's' : ''} affichée
            {filteredAnalyses.length > 1 ? 's' : ''}
            {(searchQuery || statusFilter !== 'all' || gradeFilter !== 'all') && stats && (
              <span> sur {stats.total} au total</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
