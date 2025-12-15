import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import {
  FileText, PiggyBank, Hammer, Eye, Plus, BarChart3, MoreVertical, Trash2, Filter,
  MapPin, Calendar, Euro, FolderOpen, Edit, Copy, FileSearch, Loader2
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { devisService } from '@/services/api';
import { toast } from 'sonner';
import { Phase0ProjectService, PHASE0_STATUS_CONFIG, Phase0Status } from '@/services/phase0';

export default function DashboardPage() {
  const { user, userType, projects, phase0Projects, setProjects, refreshPhase0Projects } = useApp();
  const navigate = useNavigate();

  // Redirection automatique des B2B vers /pro
  if (userType === 'B2B') {
    return <Navigate to="/pro" replace />;
  }

  const completedAnalyses = projects.filter(p => p.status === 'completed');

  // Calculate total savings from completed projects based on price comparisons
  const totalSavings = completedAnalyses.reduce((sum, p) => {
    if (p.analysisResult?.priceComparison) {
      const current = p.analysisResult.priceComparison.current;
      const high = p.analysisResult.priceComparison.high;
      return sum + Math.max(0, high - current);
    }
    return sum;
  }, 0);

  // Projets Phase0 actifs (non archivés/annulés)
  const activePhase0Projects = phase0Projects.filter(
    p => p.status !== 'archived' && p.status !== 'cancelled'
  );

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

  const handleDeletePhase0Project = async (projectId: string, projectTitle: string) => {
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer "${projectTitle}" ? Cette action est irréversible.`);

    if (!confirmed) return;

    try {
      await Phase0ProjectService.deleteProject(projectId);
      await refreshPhase0Projects();
      toast.success('Projet supprimé avec succès');
    } catch (error) {
      console.error('Error deleting phase0 project:', error);
      toast.error('Erreur lors de la suppression du projet');
    }
  };

  // Rendu du statut Phase0
  const renderPhase0Status = (status: Phase0Status) => {
    const config = PHASE0_STATUS_CONFIG[status];
    const variants: Record<Phase0Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      in_progress: 'default',
      pending_validation: 'outline',
      validated: 'default',
      archived: 'secondary',
      cancelled: 'destructive',
    };

    return (
      <Badge variant={variants[status]}>
        {config.label}
      </Badge>
    );
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
              <Link to="/phase0">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Définir un projet
                </Button>
              </Link>
            </div>
          </div>

          {/* Statistiques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Projets en cours de définition */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Projets en définition</p>
                    <p className="text-2xl font-bold text-foreground">
                      {activePhase0Projects.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Hammer className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analyses réalisées */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Devis analysés</p>
                    <p className="text-2xl font-bold text-foreground">
                      {completedAnalyses.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <FileSearch className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Économies détectées */}
            {totalSavings > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Économies détectées</p>
                      <p className="text-2xl font-bold text-success">
                        {Math.round(totalSavings).toLocaleString()}€
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                      <PiggyBank className="w-6 h-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Section principale : Mes Projets Phase0 */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    Mes projets de travaux
                  </CardTitle>
                  <Link to="/phase0">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau projet
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {activePhase0Projects.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Commencez par définir votre projet
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Avant d'analyser un devis, décrivez votre projet de travaux.
                      TORP vous aidera à cadrer professionnellement votre besoin
                      pour une analyse plus pertinente.
                    </p>
                    <Link to="/phase0">
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Définir mon projet
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activePhase0Projects.map((project) => (
                      <div
                        key={project.projectId}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {renderPhase0Status(project.status)}
                            </div>
                            <h3 className="font-semibold truncate">{project.projectName}</h3>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/phase0/project/${project.projectId}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir le projet
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/phase0/wizard/${project.projectId}`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeletePhase0Project(project.projectId, project.projectName)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Adresse */}
                        {project.propertyAddress && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <MapPin className="w-4 h-4" />
                            {project.propertyAddress}
                          </div>
                        )}

                        {/* Infos */}
                        <div className="flex items-center gap-4 text-sm mb-3">
                          {project.estimatedBudget && (
                            <div className="flex items-center gap-1">
                              <Euro className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {project.estimatedBudget.min?.toLocaleString('fr-FR')} - {project.estimatedBudget.max?.toLocaleString('fr-FR')} €
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span>{project.selectedLotsCount} lot(s)</span>
                          </div>
                        </div>

                        {/* Progression */}
                        <div className="space-y-1 mb-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Complétude</span>
                            <span>{project.completeness}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${project.completeness}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate(`/phase0/project/${project.projectId}`)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/analyze?projectId=${project.projectId}`)}
                          >
                            <FileSearch className="w-4 h-4 mr-2" />
                            Analyser un devis
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section secondaire : Mes Analyses */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Mes analyses de devis
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
                                             ${project.score && project.score >= 800 ? 'bg-success text-white' :
                                project.score && project.score >= 600 ? 'bg-warning text-white' :
                                  project.score && project.score > 0 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>
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
                              <DropdownMenuItem onClick={() => navigate(`/results?devisId=${project.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir l'analyse
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                          {activePhase0Projects.length > 0
                            ? 'Sélectionnez un projet ci-dessus et analysez un devis'
                            : 'Définissez d\'abord votre projet, puis analysez vos devis'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Panneau latéral - Conseils */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Comment ça marche ?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Définissez votre projet</p>
                      <p className="text-muted-foreground">Décrivez vos travaux, votre bien, vos contraintes</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Recevez des devis</p>
                      <p className="text-muted-foreground">Sollicitez des artisans pour votre projet</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Analysez vos devis</p>
                      <p className="text-muted-foreground">TORP analyse et compare vos devis en contexte</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
