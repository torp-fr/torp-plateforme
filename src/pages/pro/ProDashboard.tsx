/**
 * TORP B2B - Dashboard Principal Professionnel
 *
 * Dashboard complet pour les professionnels B2B avec :
 * - Statistiques de l'entreprise
 * - Liste des dernières analyses de devis
 * - Accès rapide aux actions principales
 * - Notifications importantes (documents expirés)
 *
 * @route /pro/dashboard
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getCompanyProfile } from '@/services/api/pro/companyService';
import { listAnalyses } from '@/services/api/pro/analysisService';
import { checkExpiringDocuments } from '@/services/api/pro/documentService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProfileCompletenessIndicator } from '@/components/pro/ProfileCompletenessIndicator';
import {
  Building2,
  FileText,
  PlusCircle,
  Upload,
  Settings,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import type { CompanyProfile, ProDevisAnalysis, CompanyDocument } from '@/types/pro';

export default function ProDashboard() {
  const navigate = useNavigate();
  const { user, userType } = useApp();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [analyses, setAnalyses] = useState<ProDevisAnalysis[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<CompanyDocument[]>([]);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    averageScore: 0,
    completedAnalyses: 0,
    pendingAnalyses: 0,
  });

  useEffect(() => {
    // Vérifier que l'utilisateur est bien de type B2B
    if (user && userType !== 'B2B') {
      navigate('/dashboard');
    }
  }, [user, userType, navigate]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Charger le profil entreprise
      const companyProfile = await getCompanyProfile();
      setProfile(companyProfile);

      // Si un profil existe, charger les analyses et documents
      if (companyProfile) {
        // Charger les analyses
        const analysesData = await listAnalyses(companyProfile.id, { limit: 5 });
        setAnalyses(analysesData);

        // Calculer les statistiques
        const completed = analysesData.filter(a => a.status === 'COMPLETED');
        const pending = analysesData.filter(a => a.status === 'PENDING' || a.status === 'PROCESSING');
        const avgScore = completed.length > 0
          ? Math.round(completed.reduce((sum, a) => sum + (a.score_total || 0), 0) / completed.length)
          : 0;

        setStats({
          totalAnalyses: analysesData.length,
          averageScore: avgScore,
          completedAnalyses: completed.length,
          pendingAnalyses: pending.length,
        });

        // Charger les documents expirant
        const expiring = await checkExpiringDocuments(companyProfile.id);
        setExpiringDocs(expiring);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Afficher un onboarding si pas de profil entreprise
  if (!loading && !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-2">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Bienvenue sur TORP Pro</CardTitle>
              <CardDescription className="text-base mt-2">
                Complétez votre profil entreprise pour commencer à analyser vos devis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Fonctionnalités TORP Pro :</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    <span>Analysez vos propres devis et obtenez un score TORP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    <span>Recevez des recommandations d'amélioration personnalisées</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    <span>Générez des badges TORP avec QR code pour vos clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    <span>Gérez vos documents officiels (KBIS, assurances, certifications)</span>
                  </li>
                </ul>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate('/pro/onboarding')}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Créer mon profil entreprise
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Vous aurez besoin de votre numéro SIRET
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Terminée</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
      case 'PENDING':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'ERROR':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erreur</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGradeBadge = (grade?: string) => {
    if (!grade) return null;

    const gradeColors: Record<string, string> = {
      'A+': 'bg-green-600 text-white',
      'A': 'bg-green-500 text-white',
      'A-': 'bg-green-400 text-white',
      'B+': 'bg-blue-500 text-white',
      'B': 'bg-blue-400 text-white',
      'B-': 'bg-blue-300 text-white',
      'C+': 'bg-yellow-500 text-white',
      'C': 'bg-yellow-400 text-white',
      'C-': 'bg-yellow-300 text-black',
      'D': 'bg-orange-500 text-white',
      'F': 'bg-red-600 text-white',
    };

    return (
      <Badge className={gradeColors[grade] || 'bg-gray-500 text-white'}>
        {grade}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            {profile?.raison_sociale || 'Dashboard Professionnel'}
          </h1>
          {profile && (
            <p className="text-muted-foreground mt-1">
              SIRET: {profile.siret} • {profile.ville || 'Ville non renseignée'}
            </p>
          )}
        </div>

        <Button size="lg" onClick={() => navigate('/pro/new-analysis')}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Nouvelle analyse
        </Button>
      </div>

      {/* Alertes documents expirants */}
      {expiringDocs.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Documents expirant bientôt</AlertTitle>
          <AlertDescription>
            {expiringDocs.length} document(s) expire(nt) dans les 30 prochains jours.{' '}
            <Button
              variant="link"
              className="h-auto p-0 text-destructive underline"
              onClick={() => navigate('/pro/documents')}
            >
              Voir les documents
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Analyses totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAnalyses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Score moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}/1000</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedAnalyses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingAnalyses}</div>
          </CardContent>
        </Card>
      </div>

      {/* Indicateur de complétude du profil */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ProfileCompletenessIndicator companyId={profile.id} />
          </div>

          {/* Actions rapides */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
                <CardDescription>Accès rapide aux fonctionnalités principales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/pro/new-analysis')}
            >
              <PlusCircle className="w-6 h-6" />
              <div>
                <div className="font-semibold">Nouvelle analyse</div>
                <div className="text-xs text-muted-foreground">Analyser un devis</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/pro/documents')}
            >
              <Upload className="w-6 h-6" />
              <div>
                <div className="font-semibold">Mes documents</div>
                <div className="text-xs text-muted-foreground">Gérer KBIS, assurances...</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/pro/settings')}
            >
              <Settings className="w-6 h-6" />
              <div>
                <div className="font-semibold">Paramètres</div>
                <div className="text-xs text-muted-foreground">Profil entreprise</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
          </div>
        </div>
      )}

      {/* Liste des analyses récentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analyses récentes
            </CardTitle>
            <CardDescription>Les 5 dernières analyses de devis</CardDescription>
          </div>
          {analyses.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => navigate('/pro/analyses')}>
              Voir tout
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {analyses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Aucune analyse pour le moment</p>
              <Button onClick={() => navigate('/pro/new-analysis')}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Créer ma première analyse
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Projet</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyses.map((analysis) => (
                    <TableRow key={analysis.id}>
                      <TableCell className="font-medium">
                        {analysis.reference_devis}
                      </TableCell>
                      <TableCell>{analysis.nom_projet || '-'}</TableCell>
                      <TableCell>
                        {analysis.montant_ttc
                          ? `${analysis.montant_ttc.toLocaleString('fr-FR')}€ TTC`
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {analysis.score_total || '-'}/1000
                      </TableCell>
                      <TableCell className="text-center">
                        {getGradeBadge(analysis.grade)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/pro/analysis/${analysis.id}`)}
                        >
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
