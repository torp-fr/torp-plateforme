/**
 * Admin Analytics Dashboard
 * Vue d'ensemble des métriques et feedbacks
 */

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Users,
  FileText,
  MessageSquare,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { analyticsService, type AnalyticsOverview, type TorpScoreAverages } from '@/services/analytics/analyticsService';
import { feedbackService, type FeedbackSummary, type Feedback } from '@/services/feedback/feedbackService';

export default function AdminAnalytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [scoreAverages, setScoreAverages] = useState<TorpScoreAverages[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<Feedback[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('inscriptions');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Timeout après 10 secondes
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: La migration Supabase n\'a peut-être pas été appliquée')), 10000)
      );

      const dataPromise = Promise.all([
        analyticsService.getOverview(),
        analyticsService.getScoreAverages(),
        feedbackService.getFeedbackSummary(),
        feedbackService.getAllFeedbacks(),
        analyticsService.getAllUsers(),
      ]);

      const [overviewData, scoresData, feedbackData, allFeedbacksData, usersData] = await Promise.race([
        dataPromise,
        timeoutPromise
      ]) as [AnalyticsOverview | null, TorpScoreAverages[], FeedbackSummary[], Feedback[], any[]];

      setOverview(overviewData);
      setScoreAverages(scoresData);
      setFeedbackSummary(feedbackData);
      setAllFeedbacks(allFeedbacksData);
      setAllUsers(usersData);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">📊 Dashboard Admin TORP</h1>
          <p className="text-muted-foreground">Vue d'ensemble des métriques et feedbacks testeurs</p>
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
                <div className="text-3xl font-bold">{overview?.total_signups || 0}</div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">Particulier: {overview?.b2c_signups || 0}</Badge>
                <Badge variant="outline">Pro: {overview?.b2b_signups || 0}</Badge>
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
                <CardTitle>Détails des Inscriptions</CardTitle>
                <CardDescription>
                  {allUsers.length} utilisateurs inscrits
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune inscription pour le moment
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
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.map((user) => (
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
                  Liste des analyses de devis effectuées
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Fonctionnalité à venir - Affichage des analyses détaillées depuis devis_analysis_metrics
                </p>
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
                <CardTitle>Feedbacks Détaillés</CardTitle>
                <CardDescription>
                  {totalFeedbacks} feedbacks • Satisfaction moyenne: {avgSatisfaction.toFixed(1)}/5
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allFeedbacks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun feedback pour le moment
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Résumé rapide */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-4 border-b">
                      {feedbackSummary.slice(0, 4).map((item, index) => (
                        <div key={index} className="text-center p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">{item.feedback_type}</div>
                          <div className="text-lg font-bold">{item.count}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tableau des feedbacks */}
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
                          </tr>
                        </thead>
                        <tbody>
                          {allFeedbacks.map((feedback) => (
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
                              <td className="p-2 max-w-md">
                                <div className="text-sm line-clamp-2" title={feedback.message}>
                                  {feedback.message}
                                </div>
                                {feedback.page_url && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    📍 {new URL(feedback.page_url).pathname}
                                  </div>
                                )}
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
