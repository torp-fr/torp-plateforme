import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { 
  BarChart3, 
  MessageSquare, 
  Camera, 
  AlertTriangle, 
  Package, 
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Upload,
  Users,
  Building
} from 'lucide-react';

interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  date: string;
  completionDate?: string;
}

interface SupplyOrder {
  id: string;
  item: string;
  supplier: string;
  status: 'ordered' | 'shipped' | 'delivered';
  quantity: number;
  price: number;
  deliveryDate: string;
}

interface ProjectMetrics {
  totalBudget: number;
  spentAmount: number;
  remainingBudget: number;
  completionPercentage: number;
  delayDays: number;
  qualityScore: string;
}

interface Artisan {
  id: string;
  name: string;
  specialty: string;
  status: 'active' | 'completed' | 'pending';
  contact: string;
}

export default function ProjectTracking() {
  const [selectedProject] = useState({
    id: '1',
    name: 'Rénovation cuisine complète',
    startDate: '2024-01-15',
    estimatedEndDate: '2024-03-15',
    currentPhase: 'Pose du carrelage'
  });

  const [metrics] = useState<ProjectMetrics>({
    totalBudget: 15000,
    spentAmount: 8500,
    remainingBudget: 6500,
    completionPercentage: 65,
    delayDays: 3,
    qualityScore: 'A'
  });

  const [milestones] = useState<ProjectMilestone[]>([
    {
      id: '1',
      name: 'Démolition',
      description: 'Démolition de l\'ancienne cuisine',
      status: 'completed',
      date: '2024-01-15',
      completionDate: '2024-01-18'
    },
    {
      id: '2',
      name: 'Électricité et plomberie',
      description: 'Installation des nouvelles arrivées',
      status: 'completed',
      date: '2024-01-20',
      completionDate: '2024-01-25'
    },
    {
      id: '3',
      name: 'Pose du carrelage',
      description: 'Carrelage sol et mur',
      status: 'in-progress',
      date: '2024-02-01',
    },
    {
      id: '4',
      name: 'Installation meubles',
      description: 'Pose des éléments de cuisine',
      status: 'pending',
      date: '2024-02-15'
    },
    {
      id: '5',
      name: 'Finitions',
      description: 'Peinture et finitions',
      status: 'pending',
      date: '2024-03-01'
    }
  ]);

  const [supplyOrders] = useState<SupplyOrder[]>([
    {
      id: '1',
      item: 'Carrelage 60x60 Gris',
      supplier: 'Leroy Merlin',
      status: 'delivered',
      quantity: 25,
      price: 850,
      deliveryDate: '2024-01-28'
    },
    {
      id: '2',
      item: 'Éléments cuisine IKEA',
      supplier: 'IKEA',
      status: 'shipped',
      quantity: 1,
      price: 3200,
      deliveryDate: '2024-02-10'
    },
    {
      id: '3',
      item: 'Électroménager',
      supplier: 'Darty',
      status: 'ordered',
      quantity: 4,
      price: 2100,
      deliveryDate: '2024-02-20'
    }
  ]);

  const [artisans] = useState<Artisan[]>([
    {
      id: '1',
      name: 'Jean Dupont',
      specialty: 'Carreleur',
      status: 'active',
      contact: '06.12.34.56.78'
    },
    {
      id: '2',
      name: 'Marie Martin',
      specialty: 'Électricienne',
      status: 'completed',
      contact: '06.98.76.54.32'
    },
    {
      id: '3',
      name: 'Pierre Durand',
      specialty: 'Plombier',
      status: 'completed',
      contact: '06.11.22.33.44'
    }
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'ordered':
        return <Package className="w-4 h-4 text-info" />;
      case 'shipped':
        return <Package className="w-4 h-4 text-warning" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-success" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'bg-success/10 text-success border-success';
      case 'in-progress':
      case 'active':
      case 'shipped':
        return 'bg-warning/10 text-warning border-warning';
      case 'pending':
      case 'ordered':
        return 'bg-muted/10 text-muted-foreground border-muted';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <BackButton to="/dashboard" label="Dashboard" />
          </div>

          {/* En-tête du projet */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {selectedProject.name}
            </h1>
            <p className="text-muted-foreground mb-4">
              Phase actuelle : {selectedProject.currentPhase}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Début : {selectedProject.startDate}</span>
              <span>•</span>
              <span>Fin prévue : {selectedProject.estimatedEndDate}</span>
            </div>
          </div>

          {/* Métriques principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avancement</p>
                    <p className="text-2xl font-bold">{metrics.completionPercentage}%</p>
                  </div>
                </div>
                <Progress value={metrics.completionPercentage} className="mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CreditCard className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Budget utilisé</p>
                    <p className="text-2xl font-bold">{metrics.spentAmount}€</p>
                    <p className="text-xs text-muted-foreground">sur {metrics.totalBudget}€</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Retard</p>
                    <p className="text-2xl font-bold">{metrics.delayDays} jours</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-lg">
                    <FileText className="w-6 h-6 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Score TORP</p>
                    <p className="text-2xl font-bold">{metrics.qualityScore}</p>
                    <Badge className="bg-success/10 text-success border-success text-xs">
                      Score A+ avec CCTP
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Jalons du projet */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Jalons du projet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {milestones.map((milestone, index) => (
                      <div key={milestone.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getStatusIcon(milestone.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{milestone.name}</h4>
                            <Badge variant="outline" className={getStatusColor(milestone.status)}>
                              {milestone.status === 'completed' ? 'Terminé' : 
                               milestone.status === 'in-progress' ? 'En cours' : 'À venir'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {milestone.description}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            {milestone.status === 'completed' && milestone.completionDate ? (
                              <span>Terminé le {milestone.completionDate}</span>
                            ) : (
                              <span>Prévu le {milestone.date}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Commandes de fournitures */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Commandes de fournitures
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {supplyOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <h4 className="font-medium">{order.item}</h4>
                            <p className="text-sm text-muted-foreground">
                              {order.supplier} • Qté: {order.quantity} • {order.price}€
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Livraison prévue : {order.deliveryDate}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getStatusColor(order.status)}>
                          {order.status === 'ordered' ? 'Commandé' :
                           order.status === 'shipped' ? 'Expédié' : 'Livré'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Panel latéral */}
            <div className="space-y-6">
              {/* Communication avec les artisans */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Mes artisans
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {artisans.map((artisan) => (
                      <div key={artisan.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{artisan.name}</h4>
                          <Badge variant="outline" className={getStatusColor(artisan.status)}>
                            {artisan.status === 'active' ? 'Actif' :
                             artisan.status === 'completed' ? 'Terminé' : 'En attente'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{artisan.specialty}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions rapides */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Actions rapides
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button className="w-full" variant="outline">
                      <Camera className="w-4 h-4 mr-2" />
                      Ajouter des photos
                    </Button>
                    <Button className="w-full" variant="outline">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Signaler un problème
                    </Button>
                    <Button className="w-full" variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Demander un CCTP
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Building className="w-4 h-4 mr-2" />
                      Demande de financement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Financement bancaire */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Financement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Explorez nos solutions de financement avec nos partenaires bancaires.
                    </p>
                    <Button className="w-full">
                      Simuler un prêt
                    </Button>
                    <div className="text-xs text-center text-muted-foreground">
                      Partenaires : Crédit Agricole, BNP Paribas, Société Générale
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