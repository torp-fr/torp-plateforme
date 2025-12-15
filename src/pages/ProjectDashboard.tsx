import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import {
  Calendar,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  Euro,
  Camera,
  MessageSquare,
  Settings,
  BarChart3,
  MapPin,
  Hammer,
  Shield,
  Truck,
  ClipboardCheck,
  Plus,
  Edit,
  Download,
  Upload
} from 'lucide-react';

export default function ProjectDashboard() {
  const { currentProject, projects } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data enrichi pour le dashboard
  const mockProject = {
    id: '1',
    name: 'Rénovation cuisine complète',
    type: 'Rénovation',
    status: 'in-progress',
    score: 85,
    grade: 'A',
    amount: '15 000 €',
    createdAt: new Date().toISOString(),
    company: 'Maison Familiale',
    progress: 35,
    phases: [
      { id: 1, name: 'Conception & Plans', status: 'completed', progress: 100, duration: '2 semaines' },
      { id: 2, name: 'Démolition', status: 'completed', progress: 100, duration: '3 jours' },
      { id: 3, name: 'Plomberie & Électricité', status: 'in-progress', progress: 60, duration: '1 semaine' },
      { id: 4, name: 'Pose du carrelage', status: 'pending', progress: 0, duration: '4 jours' },
      { id: 5, name: 'Installation mobilier', status: 'pending', progress: 0, duration: '2 jours' },
      { id: 6, name: 'Finitions', status: 'pending', progress: 0, duration: '3 jours' }
    ],
    budget: {
      total: 15000,
      spent: 5250,
      remaining: 9750,
      breakdown: [
        { category: 'Matériaux', budgeted: 8000, spent: 3200, remaining: 4800 },
        { category: 'Main d\'œuvre', budgeted: 5000, spent: 2050, remaining: 2950 },
        { category: 'Outillage', budgeted: 1000, spent: 0, remaining: 1000 },
        { category: 'Imprévus', budgeted: 1000, spent: 0, remaining: 1000 }
      ]
    },
    team: [
      { name: 'Marc Dubois', role: 'Architecte', status: 'active', phone: '06.12.34.56.78' },
      { name: 'Pierre Martin', role: 'Plombier', status: 'active', phone: '06.98.76.54.32' },
      { name: 'Jean Leroy', role: 'Électricien', status: 'scheduled', phone: '06.45.67.89.01' },
      { name: 'Sophie Dupont', role: 'Carreleur', status: 'scheduled', phone: '06.23.45.67.89' }
    ],
    alerts: [
      { type: 'warning', message: 'Retard possible sur la livraison du carrelage', date: '2024-01-15' },
      { type: 'info', message: 'Visite de contrôle prévue vendredi', date: '2024-01-12' }
    ],
    documents: [
      { name: 'Plans architecte', type: 'PDF', date: '2024-01-08', size: '2.4 MB' },
      { name: 'Devis plomberie', type: 'PDF', date: '2024-01-10', size: '1.2 MB' },
      { name: 'Facture matériaux', type: 'PDF', date: '2024-01-12', size: '856 KB' }
    ],
    analysisResult: currentProject?.analysisResult
  };

  const project = mockProject;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in-progress': return 'bg-warning text-warning-foreground';
      case 'pending': return 'bg-muted text-muted-foreground';
      case 'delayed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'in-progress': return 'En cours';
      case 'pending': return 'En attente';
      case 'delayed': return 'Retardé';
      default: return 'Non défini';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'info': return <CheckCircle className="w-4 h-4 text-info" />;
      default: return <CheckCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* En-tête du projet */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <BackButton to="/dashboard" label="Mes analyses" />
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
                <div className="flex items-center gap-4 mt-2">
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusText(project.status)}
                  </Badge>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{project.type}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">Budget: {project.amount}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Paramètres
                </Button>
                <Button size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
              </div>
            </div>

            {/* Progression globale */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Progression globale</h3>
                  <span className="text-2xl font-bold text-primary">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2 mb-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Début: {new Date(project.createdAt).toLocaleDateString()}</span>
                  <span>Fin prévue: Mars 2024</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Onglets principaux */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Vue d'ensemble
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Planning
              </TabsTrigger>
              <TabsTrigger value="budget" className="flex items-center gap-2">
                <Euro className="w-4 h-4" />
                Budget
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Équipe
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Vue d'ensemble */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Alertes et notifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      Alertes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {project.alerts.map((alert, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          {getAlertIcon(alert.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Métriques du projet */}
                <Card>
                  <CardHeader>
                    <CardTitle>Métriques clés</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Phases terminées</span>
                        <span className="font-semibold">2/6</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Budget utilisé</span>
                        <span className="font-semibold">{Math.round((project.budget.spent / project.budget.total) * 100)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Intervenants actifs</span>
                        <span className="font-semibold">2</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Note qualité</span>
                        <Badge variant="outline" className="text-success">
                          {project.grade}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Prochaines étapes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Prochaines étapes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {project.phases.filter(phase => phase.status === 'in-progress' || phase.status === 'pending').slice(0, 3).map((phase) => (
                        <div key={phase.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <p className="font-medium text-sm">{phase.name}</p>
                            <p className="text-xs text-muted-foreground">{phase.duration}</p>
                          </div>
                              <Badge className={getStatusColor(phase.status)}>
                                {getStatusText(phase.status)}
                              </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Phases du projet */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hammer className="w-5 h-5 text-primary" />
                    Phases du projet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {project.phases.map((phase) => (
                      <div key={phase.id} className="flex items-center gap-4 p-4 rounded-lg border">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                                       ${phase.status === 'completed' ? 'bg-success' : 
                                         phase.status === 'in-progress' ? 'bg-warning' : 'bg-muted'}`}>
                          {phase.id}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{phase.name}</h4>
                            <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(phase.status)}>
                              {getStatusText(phase.status)}
                            </Badge>
                              <span className="text-sm text-muted-foreground">{phase.duration}</span>
                            </div>
                          </div>
                          <Progress value={phase.progress} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Planning */}
            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Planning détaillé
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {project.phases.map((phase, index) => (
                      <div key={phase.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                                         ${phase.status === 'completed' ? 'bg-success' : 
                                           phase.status === 'in-progress' ? 'bg-warning' : 'bg-muted'}`}>
                            {phase.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : phase.id}
                          </div>
                          {index < project.phases.length - 1 && (
                            <div className="w-px h-16 bg-border mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{phase.name}</h4>
                            <Badge className={getStatusColor(phase.status)}>
                              {getStatusText(phase.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">Durée: {phase.duration}</p>
                          <Progress value={phase.progress} className="h-2 mb-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progression: {phase.progress}%</span>
                            <span>
                              {phase.status === 'completed' ? 'Terminé' : 
                               phase.status === 'in-progress' ? 'En cours' : 'Prévu'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Budget */}
            <TabsContent value="budget" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Euro className="w-5 h-5 text-primary" />
                      Résumé budgétaire
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                        <span className="font-medium">Budget total</span>
                        <span className="text-xl font-bold">{project.budget.total.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-success/10">
                        <span className="text-success font-medium">Dépensé</span>
                        <span className="text-success font-bold">{project.budget.spent.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
                        <span className="text-primary font-medium">Restant</span>
                        <span className="text-primary font-bold">{project.budget.remaining.toLocaleString()} €</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Progress 
                        value={(project.budget.spent / project.budget.total) * 100} 
                        className="h-3" 
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        {Math.round((project.budget.spent / project.budget.total) * 100)}% du budget utilisé
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Répartition par catégorie</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {project.budget.breakdown.map((item, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{item.category}</span>
                            <span>{item.spent.toLocaleString()} € / {item.budgeted.toLocaleString()} €</span>
                          </div>
                          <Progress 
                            value={(item.spent / item.budgeted) * 100} 
                            className="h-2" 
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Équipe */}
            <TabsContent value="team" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Intervenants du projet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.team.map((member, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 rounded-lg border">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{member.name}</h4>
                          <p className="text-sm text-muted-foreground">{member.role}</p>
                          <p className="text-xs text-muted-foreground mt-1">{member.phone}</p>
                        </div>
                        <Badge 
                          className={member.status === 'active' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}
                        >
                          {member.status === 'active' ? 'Actif' : 'Programmé'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Documents du projet
                    </CardTitle>
                    <Button size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Ajouter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {project.documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">{doc.date} • {doc.size}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}