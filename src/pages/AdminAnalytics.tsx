/**
 * Admin Analytics Dashboard
 * Vue d'ensemble des métriques et feedbacks
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  Users,
  FileText,
  MessageSquare,
  Star,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash,
  Eye,
  Search,
  Filter,
} from 'lucide-react';
import { analyticsService, type AnalyticsOverview, type TorpScoreAverages } from '@/services/analytics/analyticsService';
import { feedbackService, type FeedbackSummary, type Feedback } from '@/services/feedback/feedbackService';

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [scoreAverages, setScoreAverages] = useState<TorpScoreAverages[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<Feedback[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allAnalyses, setAllAnalyses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('inscriptions');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<string>('all');
  const [analysisSearch, setAnalysisSearch] = useState('');

  // Données sélectionnées pour les modals
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      console.log('[AdminAnalytics] Chargement des données...');

      // Timeout augmenté à 30 secondes pour les connexions lentes
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Le chargement prend trop de temps. Vérifiez votre connexion ou les migrations Supabase.')), 30000)
      );

      const dataPromise = Promise.all([
        analyticsService.getOverview().catch(err => {
          console.error('[AdminAnalytics] Erreur getOverview:', err);
          return null;
        }),
        analyticsService.getScoreAverages().catch(err => {
          console.error('[AdminAnalytics] Erreur getScoreAverages:', err);
          return [];
        }),
        feedbackService.getFeedbackSummary().catch(err => {
          console.error('[AdminAnalytics] Erreur getFeedbackSummary:', err);
          return [];
        }),
        feedbackService.getAllFeedbacks().catch(err => {
          console.error('[AdminAnalytics] Erreur getAllFeedbacks:', err);
          return [];
        }),
        analyticsService.getAllUsers().catch(err => {
          console.error('[AdminAnalytics] Erreur getAllUsers:', err);
          return [];
        }),
        analyticsService.getAllAnalyses().catch(err => {
          console.error('[AdminAnalytics] Erreur getAllAnalyses:', err);
          return [];
        }),
      ]);

      const [overviewData, scoresData, feedbackData, allFeedbacksData, usersData, analysesData] = await Promise.race([
        dataPromise,
        timeoutPromise
      ]) as [AnalyticsOverview | null, TorpScoreAverages[], FeedbackSummary[], Feedback[], any[], any[]];

      console.log('[AdminAnalytics] Données chargées:', {
        overview: overviewData,
        scores: scoresData.length,
        feedback: feedbackData.length,
        allFeedbacks: allFeedbacksData.length,
        users: usersData.length,
        analyses: analysesData.length,
      });

      setOverview(overviewData);
      setScoreAverages(scoresData);
      setFeedbackSummary(feedbackData);
      setAllFeedbacks(allFeedbacksData);
      setAllUsers(usersData);
      setAllAnalyses(analysesData);
    } catch (err) {
      console.error('[AdminAnalytics] Erreur chargement:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadData(true);
  };

  // Fonctions de filtrage
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.company?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesType = userTypeFilter === 'all' || user.user_type === userTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredFeedbacks = allFeedbacks.filter(feedback => {
    const matchesSearch =
      feedback.message?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
      feedback.user_email?.toLowerCase().includes(feedbackSearch.toLowerCase());
    const matchesType = feedbackTypeFilter === 'all' || feedback.feedback_type === feedbackTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredAnalyses = allAnalyses.filter(analysis => {
    const matchesSearch =
      analysis.user_email?.toLowerCase().includes(analysisSearch.toLowerCase()) ||
      analysis.grade?.toLowerCase().includes(analysisSearch.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Chargement des métriques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Erreur de chargement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-700">{error}</p>
              <div className="bg-white p-4 rounded-md border border-red-200">
                <p className="font-medium text-sm mb-2">💡 Solution :</p>
                <p className="text-sm text-muted-foreground mb-3">
                  La migration Supabase doit être appliquée pour créer les tables nécessaires.
                </p>
                <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                  supabase db push
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Ou copiez le contenu de <code>supabase/migrations/002_analytics_feedback.sql</code> dans le SQL Editor de Supabase.
                </p>
              </div>
              <Button onClick={loadData} variant="outline" size="sm">
                Réessayer
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>📍 Où trouver les feedbacks manuellement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                En attendant l'application de la migration, vous pouvez consulter les feedbacks directement dans Supabase :
              </p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Ouvrez votre <strong>Dashboard Supabase</strong></li>
                <li>Allez dans <strong>Table Editor</strong></li>
                <li>Cherchez la table <code className="bg-gray-100 px-1 rounded">user_feedback</code></li>
                <li>Vous y trouverez tous les feedbacks avec : type, message, satisfaction, date</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalFeedbacks = feedbackSummary.reduce((sum, item) => sum + item.count, 0);
  const avgSatisfaction = feedbackSummary.length > 0
    ? feedbackSummary.reduce((sum, item) => sum + item.avg_satisfaction * item.count, 0) /
      feedbackSummary.reduce((sum, item) => sum + item.count, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">📊 Dashboard Admin TORP</h1>
            <p className="text-muted-foreground">Vue d'ensemble des métriques et feedbacks testeurs</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/admin/diagnostic')}
              variant="outline"
              size="sm"
            >
              🔧 Diagnostic
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </Button>
          </div>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveTab('inscriptions')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Inscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{allUsers.length}</div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">Particulier: {allUsers.filter(u => u.user_type === 'B2C').length}</Badge>
                <Badge variant="outline">Pro: {allUsers.filter(u => u.user_type === 'B2B').length}</Badge>
                <Badge variant="outline">Admin: {allUsers.filter(u => u.user_type === 'admin').length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Cliquer pour voir les détails</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveTab('analyses')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-primary">{overview?.total_analyses || 0}</div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">Particulier: {overview?.b2c_analyses || 0}</Badge>
                <Badge variant="outline">Pro: {overview?.b2b_analyses || 0}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Cliquer pour voir les détails</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveTab('feedbacks')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Feedbacks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">{totalFeedbacks}</div>
                <MessageSquare className="h-8 w-8 text-success" />
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{avgSatisfaction.toFixed(1)}/5 satisfaction</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Cliquer pour voir les détails</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveTab('scores')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Score TORP Moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-warning">
                  {scoreAverages.length > 0
                    ? (scoreAverages.reduce((sum, s) => sum + s.avg_overall_score, 0) / scoreAverages.length).toFixed(1)
                    : '0.0'}
                </div>
                <BarChart3 className="h-8 w-8 text-warning" />
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Sur {scoreAverages.reduce((sum, s) => sum + s.total_analyses, 0)} analyses
              </div>
              <p className="text-xs text-muted-foreground mt-2">Cliquer pour voir les détails</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="inscriptions">Inscriptions</TabsTrigger>
            <TabsTrigger value="analyses">Analyses</TabsTrigger>
            <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
            <TabsTrigger value="scores">Scores TORP</TabsTrigger>
          </TabsList>

          <TabsContent value="inscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Détails des Inscriptions</CardTitle>
                    <CardDescription>
                      {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} ({allUsers.length} au total)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="B2C">Particulier</SelectItem>
                        <SelectItem value="B2B">Professionnel</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {userSearch || userTypeFilter !== 'all' ? 'Aucun résultat' : 'Aucune inscription pour le moment'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Nom</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Entreprise</th>
                          <th className="text-left p-2">Téléphone</th>
                          <th className="text-left p-2">Abonnement</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-2 font-medium">{user.name || '-'}</td>
                            <td className="p-2 text-muted-foreground">{user.email}</td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-xs">
                                {user.user_type === 'B2C' ? 'Particulier' : user.user_type === 'B2B' ? 'Professionnel' : user.user_type}
                              </Badge>
                            </td>
                            <td className="p-2 text-muted-foreground">{user.company || '-'}</td>
                            <td className="p-2 text-muted-foreground">{user.phone || '-'}</td>
                            <td className="p-2">
                              <Badge
                                variant={user.subscription_status === 'active' ? 'default' : 'outline'}
                                className="text-xs"
                              >
                                {user.subscription_plan || 'free'}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelectedUser(user); }}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Voir détails
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    {selectedUser?.id === user.id && (
                                      <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                          <DialogTitle>Détails de l'utilisateur</DialogTitle>
                                          <DialogDescription>
                                            Informations complètes de l'inscription
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-sm font-medium">Nom</p>
                                              <p className="text-sm text-muted-foreground">{selectedUser.name || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Email</p>
                                              <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Type</p>
                                              <Badge>{selectedUser.user_type}</Badge>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Téléphone</p>
                                              <p className="text-sm text-muted-foreground">{selectedUser.phone || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Entreprise</p>
                                              <p className="text-sm text-muted-foreground">{selectedUser.company || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Date d'inscription</p>
                                              <p className="text-sm text-muted-foreground">
                                                {new Date(selectedUser.created_at).toLocaleString('fr-FR')}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Abonnement</p>
                                              <Badge variant={selectedUser.subscription_status === 'active' ? 'default' : 'outline'}>
                                                {selectedUser.subscription_plan || 'free'}
                                              </Badge>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">ID</p>
                                              <p className="text-xs text-muted-foreground font-mono">{selectedUser.id}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    )}
                                  </Dialog>
                                  <DropdownMenuItem>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Éditer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">
                                    <Trash className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analyses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Détails des Analyses</CardTitle>
                <CardDescription>
                  {allAnalyses.length} analyses de devis effectuées
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allAnalyses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune analyse pour le moment
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">User</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Score Global</th>
                          <th className="text-left p-2">Grade</th>
                          <th className="text-left p-2">Scores TORP</th>
                          <th className="text-left p-2">Fichier</th>
                          <th className="text-left p-2">Durée</th>
                          <th className="text-left p-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allAnalyses.map((analysis) => (
                          <tr key={analysis.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(analysis.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                  {analysis.user_email || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-xs">
                                {analysis.user_type === 'B2C' ? 'Particulier' : analysis.user_type === 'B2B' ? 'Professionnel' : analysis.user_type}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold text-primary">
                                  {analysis.torp_score_overall?.toFixed(1) || 'N/A'}
                                </div>
                                <span className="text-xs text-muted-foreground">/10</span>
                              </div>
                            </td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  analysis.grade?.startsWith('A') ? 'default' :
                                  analysis.grade?.startsWith('B') ? 'secondary' :
                                  'outline'
                                }
                                className="text-base font-bold"
                              >
                                {analysis.grade || 'N/A'}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">T:</span>
                                  <span className="font-medium">{analysis.torp_score_transparency?.toFixed(1) || 'N/A'}</span>
                                  <span className="text-muted-foreground">O:</span>
                                  <span className="font-medium">{analysis.torp_score_offer?.toFixed(1) || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">R:</span>
                                  <span className="font-medium">{analysis.torp_score_robustness?.toFixed(1) || 'N/A'}</span>
                                  <span className="text-muted-foreground">P:</span>
                                  <span className="font-medium">{analysis.torp_score_price?.toFixed(1) || 'N/A'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-xs">
                              <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground">{analysis.file_type || 'N/A'}</span>
                                <span className="text-muted-foreground">
                                  {analysis.file_size_bytes ? `${(analysis.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {analysis.analysis_duration_ms ? `${(analysis.analysis_duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                            </td>
                            <td className="p-2">
                              <Badge
                                variant={analysis.upload_success ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {analysis.upload_success ? '✓ Réussi' : '✗ Échec'}
                              </Badge>
                              {!analysis.upload_success && analysis.upload_error && (
                                <div className="text-xs text-destructive mt-1" title={analysis.upload_error}>
                                  {analysis.upload_error.substring(0, 30)}...
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scoreAverages.map((score) => (
                <Card key={score.user_type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant={score.user_type === 'B2C' ? 'default' : 'secondary'}>
                        {score.user_type}
                      </Badge>
                      <span className="text-lg">Scores moyens</span>
                    </CardTitle>
                    <CardDescription>
                      {score.total_analyses} analyses • Temps moyen: {Math.round(score.avg_duration_ms / 1000)}s
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Score Global</span>
                      <Badge variant="default" className="text-base">
                        {score.avg_overall_score.toFixed(1)}/10
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <ScoreBar label="Transparence" value={score.avg_transparency} />
                      <ScoreBar label="Offre" value={score.avg_offer} />
                      <ScoreBar label="Robustesse" value={score.avg_robustness} />
                      <ScoreBar label="Prix" value={score.avg_price} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="feedbacks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Feedbacks Détaillés</CardTitle>
                    <CardDescription>
                      {filteredFeedbacks.length} feedback{filteredFeedbacks.length > 1 ? 's' : ''} ({allFeedbacks.length} au total)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={feedbackSearch}
                        onChange={(e) => setFeedbackSearch(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={feedbackTypeFilter} onValueChange={setFeedbackTypeFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="feature_request">Feature</SelectItem>
                        <SelectItem value="improvement">Amélioration</SelectItem>
                        <SelectItem value="praise">Compliment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredFeedbacks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {feedbackSearch || feedbackTypeFilter !== 'all' ? 'Aucun résultat' : 'Aucun feedback pour le moment'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">User</th>
                          <th className="text-left p-2">Message</th>
                          <th className="text-left p-2">Satisfaction</th>
                          <th className="text-left p-2">Statut</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFeedbacks.map((feedback) => (
                          <tr key={feedback.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(feedback.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-xs">
                                {feedback.feedback_type}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="text-xs w-fit">
                                  {feedback.user_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {feedback.user_email}
                                </span>
                              </div>
                            </td>
                            <td className="p-2 max-w-sm">
                              <div className="text-sm line-clamp-2">
                                {feedback.message}
                              </div>
                            </td>
                            <td className="p-2">
                              {feedback.satisfaction_score ? (
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  <span className="font-medium">{feedback.satisfaction_score}/5</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  feedback.status === 'resolved' ? 'default' :
                                  feedback.status === 'in_progress' ? 'secondary' :
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {feedback.status}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelectedFeedback(feedback); }}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Voir détails
                                      </DropdownMenuItem>
                                    </DialogTrigger>
                                    {selectedFeedback?.id === feedback.id && (
                                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                          <DialogTitle>Détails du Feedback</DialogTitle>
                                          <DialogDescription>
                                            Feedback complet avec toutes les informations
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-sm font-medium">Type</p>
                                              <Badge>{selectedFeedback.feedback_type}</Badge>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Statut</p>
                                              <Badge variant={selectedFeedback.status === 'resolved' ? 'default' : 'outline'}>
                                                {selectedFeedback.status}
                                              </Badge>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Utilisateur</p>
                                              <p className="text-sm text-muted-foreground">{selectedFeedback.user_email}</p>
                                              <Badge variant="secondary" className="text-xs mt-1">{selectedFeedback.user_type}</Badge>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium">Date</p>
                                              <p className="text-sm text-muted-foreground">
                                                {new Date(selectedFeedback.created_at).toLocaleString('fr-FR')}
                                              </p>
                                            </div>
                                            {selectedFeedback.satisfaction_score && (
                                              <div>
                                                <p className="text-sm font-medium">Satisfaction</p>
                                                <div className="flex items-center gap-1">
                                                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                  <span className="font-medium">{selectedFeedback.satisfaction_score}/5</span>
                                                </div>
                                              </div>
                                            )}
                                            {selectedFeedback.page_url && (
                                              <div>
                                                <p className="text-sm font-medium">Page</p>
                                                <p className="text-xs text-muted-foreground break-all">{selectedFeedback.page_url}</p>
                                              </div>
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium mb-2">Message complet</p>
                                            <div className="p-4 bg-muted rounded-lg">
                                              <p className="text-sm whitespace-pre-wrap">{selectedFeedback.message}</p>
                                            </div>
                                          </div>
                                          {selectedFeedback.admin_notes && (
                                            <div>
                                              <p className="text-sm font-medium mb-2">Notes admin</p>
                                              <div className="p-4 bg-muted rounded-lg">
                                                <p className="text-sm whitespace-pre-wrap">{selectedFeedback.admin_notes}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </DialogContent>
                                    )}
                                  </Dialog>
                                  <DropdownMenuItem>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Éditer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">
                                    <Trash className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Composant helper pour afficher une barre de score
function ScoreBar({ label, value }: { label: string; value: number }) {
  const percentage = (value / 10) * 100;
  const color = value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}/10</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
