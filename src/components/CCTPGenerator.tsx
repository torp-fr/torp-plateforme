import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Settings,
  Wrench,
  Package,
  Shield,
  Building
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface CCTPSection {
  id: string;
  title: string;
  content: string[];
  status: 'completed' | 'in-progress' | 'pending';
  priority: 'high' | 'medium' | 'low';
}

interface CCTPGeneratorProps {
  projectId: string;
  analysisResult: any;
}

export function CCTPGenerator({ projectId, analysisResult }: CCTPGeneratorProps) {
  const { userType, currentProject } = useApp();
  const [selectedView, setSelectedView] = useState<'overview' | 'interactive'>('overview');
  
  // Simulation des sections CCTP basées sur l'analyse
  const cctpSections: CCTPSection[] = [
    {
      id: 'general',
      title: 'Dispositions générales',
      content: [
        'Objet du marché : ' + currentProject?.name,
        'Localisation : Domicile client',
        'Durée prévisionnelle : 2-3 semaines',
        'Conditions d\'accès au chantier'
      ],
      status: 'completed',
      priority: 'high'
    },
    {
      id: 'technical',
      title: 'Spécifications techniques',
      content: [
        'Normes applicables : NF DTU 60.1 (plomberie)',
        'Matériaux conformes aux normes CE',
        'Techniques de pose selon règles de l\'art',
        'Contrôles qualité requis'
      ],
      status: 'completed',
      priority: 'high'
    },
    {
      id: 'materials',
      title: 'Fournitures et matériaux',
      content: [
        'Carrelage : Grès cérame 60x60cm classe 3',
        'Sanitaires : Marque Villeroy & Boch',
        'Robinetterie : Grohe série Eurosmart',
        'Étanchéité : Membrane SPEC'
      ],
      status: 'completed',
      priority: 'medium'
    },
    {
      id: 'execution',
      title: 'Modalités d\'exécution',
      content: [
        'Planning d\'intervention détaillé',
        'Préparation et protection des zones',
        'Évacuation des gravats incluse',
        'Nettoyage de fin de chantier'
      ],
      status: 'in-progress',
      priority: 'medium'
    },
    {
      id: 'quality',
      title: 'Contrôle qualité et réception',
      content: [
        'Tests d\'étanchéité obligatoires',
        'Vérification conformité électrique',
        'Réception provisoire avec réserves',
        'Garantie décennale et biennale'
      ],
      status: 'pending',
      priority: 'high'
    },
    {
      id: 'safety',
      title: 'Sécurité et environnement',
      content: [
        'Plan de prévention des risques',
        'EPI obligatoires pour les intervenants',
        'Gestion des déchets conforme',
        'Assurance responsabilité civile'
      ],
      status: 'completed',
      priority: 'low'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success border-success/20';
      case 'in-progress':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'pending':
        return 'bg-muted/50 text-muted-foreground border-border';
      default:
        return 'bg-muted/50 text-muted-foreground border-border';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Shield className="w-4 h-4 text-destructive" />;
      case 'medium':
        return <Settings className="w-4 h-4 text-warning" />;
      case 'low':
        return <Wrench className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const completedSections = cctpSections.filter(s => s.status === 'completed').length;
  const progressPercentage = (completedSections / cctpSections.length) * 100;

  const handleDownloadPDF = () => {
    // Simulation du téléchargement PDF
    const link = document.createElement('a');
    link.href = '#';
    link.download = `CCTP_${currentProject?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* En-tête CCTP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Cahier des Charges Techniques Personnalisé
              </CardTitle>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  {userType === 'B2C' ? 'Client particulier' : 'Client professionnel'}
                </Badge>
                <Badge variant="outline">
                  Projet : {currentProject?.name}
                </Badge>
              </div>
            </div>
            <Button onClick={handleDownloadPDF} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Télécharger PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Progression du CCTP : {completedSections}/{cctpSections.length} sections complétées
              </span>
              <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Sélecteur de vue */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="interactive">Vue interactive</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {cctpSections.map((section, index) => (
              <Card key={section.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {index + 1}.
                        </span>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                      </div>
                      {getPriorityIcon(section.priority)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(section.status)}>
                        {getStatusIcon(section.status)}
                        <span className="ml-1 capitalize">{section.status.replace('-', ' ')}</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Vue interactive */}
        <TabsContent value="interactive" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cctpSections.map((section) => (
              <Card 
                key={section.id} 
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  section.status === 'completed' 
                    ? 'border-success/20 bg-success/5' 
                    : section.status === 'in-progress'
                    ? 'border-warning/20 bg-warning/5'
                    : 'border-border bg-background'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base leading-tight">
                        {section.title}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(section.status)}
                        <span className="text-xs text-muted-foreground capitalize">
                          {section.status.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                    {getPriorityIcon(section.priority)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {section.content.length} éléments définis
                    </div>
                    <div className="space-y-1">
                      {section.content.slice(0, 2).map((item, index) => (
                        <div key={index} className="text-xs text-muted-foreground truncate">
                          • {item}
                        </div>
                      ))}
                      {section.content.length > 2 && (
                        <div className="text-xs text-primary">
                          +{section.content.length - 2} autres éléments
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Résumé pour profil entreprise */}
          {userType === 'B2B' && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Tableau de bord CCTP - Vue Entreprise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Sections critiques</div>
                    <div className="text-2xl font-bold text-destructive">
                      {cctpSections.filter(s => s.priority === 'high').length}
                    </div>
                    <div className="text-xs text-muted-foreground">À valider en priorité</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">En cours</div>
                    <div className="text-2xl font-bold text-warning">
                      {cctpSections.filter(s => s.status === 'in-progress').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Sections en préparation</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Finalisées</div>
                    <div className="text-2xl font-bold text-success">
                      {cctpSections.filter(s => s.status === 'completed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Prêtes pour validation</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}