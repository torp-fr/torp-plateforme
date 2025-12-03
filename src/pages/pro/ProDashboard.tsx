/**
 * ProDashboard Page
 * Tableau de bord pour les professionnels B2B
 * Utilise la table devis (même que B2C)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProLayout } from '@/components/pro/ProLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  FileSearch,
  Ticket,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
} from 'lucide-react';

interface DashboardStats {
  totalAnalyses: number;
  averageScore: number | null;
  ticketsGeneres: number;
  documentsExpirant: number;
  analysesEnCours: number;
}

interface RecentAnalysis {
  id: string;
  nom_projet: string | null;
  file_name: string | null;
  type_travaux: string | null;
  status: string;
  score_total: number | null;
  grade: string | null;
  created_at: string;
}

export default function ProDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCompanyAndData();
    }
  }, [user?.id]);

  async function loadCompanyAndData() {
    try {
      setLoading(true);

      // Vérifier si l'utilisateur a une entreprise
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (companyError || !company) {
        setHasCompany(false);
        setLoading(false);
        return;
      }

      setHasCompany(true);
      setCompanyId(company.id);

      // Charger les analyses depuis la table devis (même que B2C)
      const { data: analyses } = await supabase
        .from('devis')
        .select('id, nom_projet, file_name, type_travaux, status, score_total, grade, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      const completed = analyses?.filter((a) => a.status === 'analyzed') || [];
      const pending = analyses?.filter((a) => a.status === 'analyzing' || a.status === 'uploaded') || [];

      // Calculer les stats
      const avgScore =
        completed.length > 0
          ? Math.round(
              completed.reduce((sum, a) => sum + (a.score_total || 0), 0) /
                completed.length
            )
          : null;

      // Compter les documents expirant (dans les 30 prochains jours)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let expiringDocs = 0;
      try {
        const { count } = await supabase
          .from('company_documents')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .lt('date_expiration', thirtyDaysFromNow.toISOString())
          .gt('date_expiration', new Date().toISOString());
        expiringDocs = count || 0;
      } catch (e) {
        // Table might not exist yet
        console.log('[ProDashboard] company_documents table not available');
      }

      // Compter les tickets (table torp_tickets si elle existe)
      let ticketsCount = 0;
      try {
        const { count } = await supabase
          .from('torp_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);
        ticketsCount = count || 0;
      } catch (e) {
        // Table might not exist yet
        console.log('[ProDashboard] torp_tickets table not available');
      }

      setStats({
        totalAnalyses: completed.length,
        averageScore: avgScore,
        ticketsGeneres: ticketsCount,
        documentsExpirant: expiringDocs,
        analysesEnCours: pending.length,
      });

      setRecentAnalyses((analyses || []).slice(0, 5));
    } catch (error) {
      console.error('[ProDashboard] Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  function getGradeBg(grade: string) {
    switch (grade) {
      case 'A':
      case 'A+':
        return 'bg-emerald-500';
      case 'B':
        return 'bg-green-500';
      case 'C':
        return 'bg-yellow-500';
      case 'D':
        return 'bg-orange-500';
      case 'E':
      case 'F':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'analyzed':
        return <Badge variant="default" className="bg-green-500">Terminé</Badge>;
      case 'analyzing':
        return <Badge variant="secondary">En cours</Badge>;
      case 'uploaded':
        return <Badge variant="outline">En attente</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <ProLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProLayout>
    );
  }

  // Si pas d'entreprise, afficher l'onboarding
  if (!hasCompany) {
    return (
      <ProLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">
            Bienvenue sur TORP Pro
          </h1>
          <p className="text-muted-foreground mb-8">
            Pour commencer, vous devez créer le profil de votre entreprise.
            Cela nous permettra de personnaliser vos analyses et de générer
            des tickets TORP pour vos clients.
          </p>
          <Button size="lg" onClick={() => navigate('/pro/onboarding')}>
            <PlusCircle className="h-5 w-5 mr-2" />
            Créer mon profil entreprise
          </Button>
        </div>
      </ProLayout>
    );
  }

  return (
    <ProLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord</h1>
            <p className="text-muted-foreground">
              Bienvenue, {user?.name || 'Professionnel'}
            </p>
          </div>
          <Button asChild>
            <Link to="/pro/analyses/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nouvelle analyse
            </Link>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Score moyen</p>
                  <p className="text-xl font-bold">
                    {stats?.averageScore ?? 'N/A'}
                    {stats?.averageScore && <span className="text-sm font-normal text-muted-foreground">/1000</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Analyses</p>
                  <p className="text-xl font-bold">{stats?.totalAnalyses ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">En cours</p>
                  <p className="text-xl font-bold">{stats?.analysesEnCours ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Ticket className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tickets</p>
                  <p className="text-xl font-bold">{stats?.ticketsGeneres ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Docs expirant</p>
                  <p className="text-xl font-bold">{stats?.documentsExpirant ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analyses récentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dernières analyses</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pro/analyses">
                Voir tout <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAnalyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="mb-4">Aucune analyse pour le moment</p>
                <Button asChild>
                  <Link to="/pro/analyses/new">Analyser mon premier devis</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {analysis.grade ? (
                        <span
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getGradeBg(
                            analysis.grade
                          )}`}
                        >
                          {analysis.grade}
                        </span>
                      ) : (
                        <span className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {analysis.nom_projet || analysis.file_name || 'Sans nom'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {analysis.type_travaux || 'Type non spécifié'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {getStatusBadge(analysis.status)}
                      {analysis.status === 'analyzed' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/results?devisId=${analysis.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertes documents */}
        {stats && stats.documentsExpirant > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-700">
                    {stats.documentsExpirant} document(s) expire(nt) bientôt
                  </p>
                  <p className="text-sm text-orange-600 mt-1">
                    Pensez à mettre à jour vos documents pour maintenir votre score TORP.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/pro/documents')}
                  >
                    Voir mes documents
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProLayout>
  );
}
