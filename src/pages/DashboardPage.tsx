import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { FileText, PiggyBank, Hammer, Eye, Plus, BarChart3, MoreVertical, Trash2, Filter } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { devisService } from '@/services/api';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user, userType, projects, setProjects } = useApp();

  // Redirection automatique des B2B vers /pro
  if (userType === 'B2B') {
    return <Navigate to="/pro" replace />;
  }

  const completedProjects = projects.filter(p => p.status === 'completed');

  // Calculate total savings from completed projects based on price comparisons
  const totalSavings = completedProjects.reduce((sum, p) => {
    if (p.analysisResult?.priceComparison) {
      const current = p.analysisResult.priceComparison.current;
      const high = p.analysisResult.priceComparison.high;
      return sum + Math.max(0, high - current);
    }
    return sum;
  }, 0);

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
      case 'completed': return 'Analysé';
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

  const handleDeleteDevis = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer "${projectName}" ? Cette action est irréversible.`);

    if (!confirmed) return;

    try {
      await devisService.deleteDevis(projectId);
      // Update local state
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Devis supprimé avec succès');
    } catch (error) {
      console.error('Error deleting devis:', error);
      toast.error('Erreur lors de la suppression du devis');
    }
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
                <h1 className="text-3xl font-bold text-foreground">
                  Tableau de bord
                </h1>
                <p className="text-muted-foreground mt-2">
                  {user ? `Bonjour ${user.name}` : 'Bienvenue sur TORP'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/analyze">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Analyser un devis
                </Button>
              </Link>
            </div>
          </div>

          {/* Statistiques principales - B2C uniquement */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {(
              <>
                {completedProjects.length > 0 && (
                  <>
                    {totalSavings > 0 && (
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Économies détectées</p>
                              <p className="text-2xl font-bold text-primary">
                                {Math.round(totalSavings).toLocaleString()}€
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                              <PiggyBank className="w-6 h-6 text-primary" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {projects.filter(p => p.status === 'analyzing' || p.status === 'draft').length > 0 && (
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
                )}
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Historique des analyses */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Mes analyses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {projects.slice(0, 5).map(project => (
                      <div key={project.id} className="relative group">
                        <Link to={`/results?devisId=${project.id}`} className="block">
                          <div className="flex items-center justify-between p-4 pr-14 border border-border rounded-lg hover:shadow-soft hover:border-primary/50 transition-all cursor-pointer">
                            <div className="flex items-center space-x-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                                             ${project.score >= 800 ? 'bg-success text-white' :
                                               project.score >= 600 ? 'bg-warning text-white' :
                                               project.score > 0 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>
                                {project.grade}
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground">{project.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {project.company || 'Entreprise'} • {new Date(project.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="text-lg font-semibold text-foreground">{project.amount}</span>
                            </div>
                          </div>
                        </Link>

                        {/* Menu contextuel */}
                        <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => console.log('Voir détails', project.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir l'analyse
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => console.log('Filter', project.id)}>
                                <Filter className="mr-2 h-4 w-4" />
                                Filtrer similaires
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteDevis(project.id, project.name)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}