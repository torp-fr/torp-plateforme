import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { AdvancedAnalytics } from '@/components/AdvancedAnalytics';
import { ActiveAssistant } from '@/components/ActiveAssistant';
import { FileText, TrendingUp, PiggyBank, Hammer, Eye, Plus, BarChart3, Users, Building, Clock, Activity, Target, Calendar, Download, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user, userType, projects } = useApp();

  const completedProjects = projects.filter(p => p.status === 'completed');
  const avgScore = completedProjects.length > 0 
    ? Math.round(completedProjects.reduce((sum, p) => sum + (p.score || 0), 0) / completedProjects.length)
    : 0;
  const totalSavings = 2850; // Mock data

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'analyzing': return 'bg-warning text-warning-foreground';
      case 'draft': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'analyzing': return 'En cours';
      case 'draft': return 'Brouillon';
      default: return 'Inconnu';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* En-tête avec salutation */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                {userType === 'B2C' ? (
                  <>
                    <h1 className="text-3xl font-bold text-foreground">
                      Tableau de bord
                    </h1>
                    <p className="text-muted-foreground mt-2">
                      {user ? `Bonjour ${user.name}` : 'Bienvenue sur TORP'}
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-foreground">
                      Espace Professionnel
                    </h1>
                    <p className="text-muted-foreground mt-2">
                      {user ? `Bonjour ${user.name}` : 'Bienvenue sur TORP'}
                      {(userType === 'B2B' || userType === 'B2B2C') && user?.company && ` - ${user.company}`}
                    </p>
                  </>
                )}
              </div>
            </div>
            {userType === 'B2B' ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
                <Link to="/improved-b2b-dashboard">
                  <Button size="sm">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Dashboard Avancé
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/analyze">
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Analyser un devis
                </Button>
              </Link>
            )}
          </div>

          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Métriques spécifiques pour entreprises */}
            {(userType === 'B2B' || userType === 'B2B2C') && (
              <>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
                        <p className="text-2xl font-bold text-foreground">€142.5K</p>
                        <p className="text-xs text-success">+12% ce mois</p>
                      </div>
                      <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Taux conversion</p>
                        <p className="text-2xl font-bold text-foreground">73%</p>
                        <p className="text-xs text-success">+5% ce mois</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Target className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Délai moyen réponse</p>
                        <p className="text-2xl font-bold text-foreground">2.3j</p>
                        <p className="text-xs text-warning">Objectif: 2j</p>
                      </div>
                      <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Projets actifs</p>
                        <p className="text-2xl font-bold text-foreground">18</p>
                        <p className="text-xs text-info">6 en cours</p>
                      </div>
                      <div className="w-12 h-12 bg-info/10 rounded-full flex items-center justify-center">
                        <Activity className="w-6 h-6 text-info" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Métriques générales pour particuliers */}
            {userType === 'B2C' && (
              <>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Devis analysés</p>
                        <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Score moyen</p>
                        <p className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>
                          {avgScore > 0 ? `${avgScore}/100` : 'N/A'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Économies détectées</p>
                        <p className="text-2xl font-bold text-primary">{totalSavings}€</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <PiggyBank className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Projets en cours</p>
                        <p className="text-2xl font-bold text-foreground">
                          {projects.filter(p => p.status === 'analyzing' || p.status === 'draft').length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
                        <Hammer className="w-6 h-6 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Redirection vers dashboard spécialisé pour B2B */}
          {userType === 'B2B' && (
            <div className="mb-8">
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Dashboard Entreprise Avancé
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Accédez à votre dashboard professionnel avec analytics avancés, gestion d'équipe et suivi commercial.
                  </p>
                  <Link to="/improved-b2b-dashboard">
                    <Button>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Accéder au dashboard avancé
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Redirection vers dashboard spécialisé pour B2G */}
          {userType === 'B2G' && (
            <div className="mb-8">
              <Card className="border-success/20 bg-gradient-to-r from-success/5 to-success/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🏛️
                    Dashboard Collectivités
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Gestion intelligente de votre patrimoine immobilier avec maintenance prédictive et optimisation énergétique.
                  </p>
                  <Link to="/collectivites-dashboard">
                    <Button className="bg-success hover:bg-success/90">
                      <Building className="w-4 h-4 mr-2" />
                      Accéder au dashboard patrimoine
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Redirection vers dashboard spécialisé pour B2B2C */}
          {userType === 'B2B2C' && (
            <div className="mb-8">
              <Card className="border-warning/20 bg-gradient-to-r from-warning/5 to-warning/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🎯
                    Dashboard Prescripteurs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Certifiez la qualité des entreprises que vous recommandez avec les analyses TORP illimitées.
                  </p>
                  <Link to="/prescripteurs-dashboard">
                    <Button className="bg-warning hover:bg-warning/90 text-warning-foreground">
                      <Target className="w-4 h-4 mr-2" />
                      Accéder au dashboard prescripteur
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Historique des analyses */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      {userType === 'B2C' ? 'Mes analyses' : 'Analyses clients'}
                    </CardTitle>
                    <Link to="/projects">
                      <Button variant="outline" size="sm">
                        Voir tout
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.slice(0, 5).map(project => (
                      <div key={project.id} 
                           className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-soft transition-shadow">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold
                                         ${project.score && project.score >= 80 ? 'bg-success' : 
                                           project.score && project.score >= 60 ? 'bg-warning' : 
                                           project.score ? 'bg-destructive' : 'bg-muted'}`}>
                            {project.grade || '?'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{project.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {project.company} • {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge className={getStatusColor(project.status)}>
                            {getStatusText(project.status)}
                          </Badge>
                          <span className="text-lg font-semibold text-foreground">{project.amount}</span>
                          {project.status === 'completed' && (
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {projects.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          Aucune analyse pour le moment
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          Commencez par analyser votre premier devis
                        </p>
                        <Link to="/analyze">
                          <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Analyser un devis
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Panneau latéral */}
            <div className="space-y-6">
              {/* Actions rapides */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link to="/analyze" className="block">
                    <Button className="w-full justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle analyse
                    </Button>
                  </Link>
                  <Link to="/projects" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="w-4 h-4 mr-2" />
                      Mes projets
                    </Button>
                  </Link>
                  <Link to="/pricing" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Voir les tarifs
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Recommandations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommandations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {userType === 'B2C' ? (
                    <>
                      <div className="p-3 bg-info/10 rounded-lg">
                        <p className="text-sm font-medium text-info">Conseil du jour</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Toujours demander 3 devis pour comparer les offres
                        </p>
                      </div>
                      <div className="p-3 bg-warning/10 rounded-lg">
                        <p className="text-sm font-medium text-warning">Attention</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Méfiez-vous des acomptes supérieurs à 30%
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-success/10 rounded-lg">
                        <p className="text-sm font-medium text-success">Optimisation</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Vos devis obtiennent une note moyenne de A
                        </p>
                      </div>
                      <div className="p-3 bg-info/10 rounded-lg">
                        <p className="text-sm font-medium text-info">Suggestion</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Précisez davantage les délais pour améliorer vos scores
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Analytics avancés pour B2B */}
            {userType === 'B2B' && (
              <div className="lg:col-span-3 mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Analytics Commercial - Aperçu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AdvancedAnalytics userType="B2B" />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Assistant IA actif */}
          {userType !== 'admin' && <ActiveAssistant userType={userType as 'B2C' | 'B2B' | 'B2G' | 'B2B2C'} />}
        </div>
      </div>
    </div>
  );
}