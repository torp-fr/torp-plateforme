import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { FileText, Search, Filter, Eye, Download, Calendar, MapPin, Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Projects() {
  const { projects, userType } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesType = typeFilter === 'all' || project.type.toLowerCase().includes(typeFilter.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'analyzing': return 'bg-warning text-warning-foreground';
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'accepted': return 'bg-info text-info-foreground';
      case 'rejected': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Analysé';
      case 'analyzing': return 'En cours';
      case 'draft': return 'Brouillon';
      case 'accepted': return 'Accepté';
      case 'rejected': return 'Refusé';
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
          {/* En-tête */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {userType === 'particulier' ? 'Mes projets' : 'Projets clients'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gérez et suivez tous vos {userType === 'particulier' ? 'projets de travaux' : 'devis clients'}
                </p>
              </div>
            </div>
            <Link to="/analyze">
              <Button size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau projet
              </Button>
            </Link>
          </div>

          {/* Filtres et recherche */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un projet..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="completed">Analysé</SelectItem>
                    <SelectItem value="analyzing">En cours</SelectItem>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    {userType === 'particulier' && (
                      <>
                        <SelectItem value="accepted">Accepté</SelectItem>
                        <SelectItem value="rejected">Refusé</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="plomberie">Plomberie</SelectItem>
                    <SelectItem value="electricite">Électricité</SelectItem>
                    <SelectItem value="peinture">Peinture</SelectItem>
                    <SelectItem value="renovation">Rénovation</SelectItem>
                    <SelectItem value="cuisine">Cuisine</SelectItem>
                    <SelectItem value="salle-de-bain">Salle de bain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Liste des projets */}
          <div className="grid gap-6">
            {filteredProjects.map(project => (
              <Card key={project.id} className="hover:shadow-medium transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      {/* Score/Grade */}
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg
                                     ${project.score && project.score >= 80 ? 'bg-success' : 
                                       project.score && project.score >= 60 ? 'bg-warning' : 
                                       project.score ? 'bg-destructive' : 'bg-muted'}`}>
                        {project.grade || '?'}
                      </div>
                      
                      {/* Informations du projet */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{project.name}</h3>
                          <Badge className={getStatusColor(project.status)}>
                            {getStatusText(project.status)}
                          </Badge>
                          {project.score && (
                            <Badge variant="outline" className={getScoreColor(project.score)}>
                              {project.score}/100
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{project.type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                          </div>
                          {project.company && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{project.company}</span>
                            </div>
                          )}
                        </div>

                        {/* Résumé de l'analyse si disponible */}
                        {project.analysisResult && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {project.analysisResult.strengths?.length > 0 && (
                                <div>
                                  <span className="font-medium text-success">Points forts:</span>
                                  <span className="ml-2 text-muted-foreground">
                                    {project.analysisResult.strengths[0]}
                                  </span>
                                </div>
                              )}
                              {project.analysisResult.warnings?.length > 0 && (
                                <div>
                                  <span className="font-medium text-warning">À vérifier:</span>
                                  <span className="ml-2 text-muted-foreground">
                                    {project.analysisResult.warnings[0]}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions et montant */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-foreground">{project.amount}</div>
                        {project.score && (
                          <div className="text-sm text-muted-foreground">
                            Note {project.grade}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {project.status === 'completed' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // Simuler la navigation vers les résultats de ce projet
                                window.location.href = '/results';
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Voir
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-1" />
                              PDF
                            </Button>
                          </>
                        )}
                        {project.status === 'draft' && (
                          <Link to="/analyze">
                            <Button size="sm">
                              Continuer
                            </Button>
                          </Link>
                        )}
                        {userType === 'particulier' && project.status === 'completed' && (
                          <>
                            <Button variant="outline" size="sm" className="text-success border-success">
                              Accepter
                            </Button>
                            <Button variant="outline" size="sm" className="text-destructive border-destructive">
                              Refuser
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredProjects.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Aucun projet trouvé
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                      ? 'Essayez de modifier vos critères de recherche' 
                      : 'Commencez par analyser votre premier devis'}
                  </p>
                  <Link to="/analyze">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Analyser un devis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}