import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Building,
  Info,
  TrendingUp,
  Zap,
  MapPin,
  Phone,
  Mail,
  Download,
  Plus,
  Eye,
  Edit3,
  Send
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
  const navigate = useNavigate();
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

  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null);
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showAddPhoto, setShowAddPhoto] = useState(false);

  const ProjectDetailDialog = ({ milestone }: { milestone: ProjectMilestone }) => (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {getStatusIcon(milestone.status)}
          {milestone.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Statut</Label>
            <Badge className={`mt-1 ${getStatusColor(milestone.status)}`}>
              {milestone.status === 'completed' ? 'Terminé' : 
               milestone.status === 'in-progress' ? 'En cours' : 'À venir'}
            </Badge>
          </div>
          <div>
            <Label className="text-sm font-medium">Date prévue</Label>
            <p className="text-sm mt-1">{milestone.date}</p>
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <p className="text-sm mt-1 text-muted-foreground">{milestone.description}</p>
        </div>
        {milestone.completionDate && (
          <div>
            <Label className="text-sm font-medium">Date de réalisation</Label>
            <p className="text-sm mt-1 text-success">{milestone.completionDate}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Photos/Documents</Label>
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une photo
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  const ArtisanDetailDialog = ({ artisan }: { artisan: Artisan }) => (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{artisan.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Badge className={getStatusColor(artisan.status)}>
            {artisan.status === 'active' ? 'Actif' :
             artisan.status === 'completed' ? 'Terminé' : 'En attente'}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{artisan.specialty}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{artisan.contact}</span>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-medium">Nouveau message</Label>
          <Textarea 
            placeholder="Écrivez votre message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <Button className="w-full">
            <Send className="w-4 h-4 mr-2" />
            Envoyer le message
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <BackButton to="/dashboard" label="Dashboard" />
          </div>

          {/* En-tête du projet optimisé */}
          <div className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {selectedProject.name}
                </h1>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-warning animate-pulse"></div>
                  <span className="text-lg text-muted-foreground">
                    {selectedProject.currentPhase}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Edit3 className="w-4 h-4 mr-2" />
                Modifier le projet
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Début : {selectedProject.startDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Fin prévue : {selectedProject.estimatedEndDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span>65% d'avancement</span>
              </div>
            </div>
          </div>

          {/* Métriques principales optimisées */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-lg transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <Info className="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avancement global</p>
                  <p className="text-3xl font-bold text-foreground">{metrics.completionPercentage}%</p>
                  <Progress value={metrics.completionPercentage} className="mt-3 h-2" />
                  <p className="text-xs text-muted-foreground mt-2">3 étapes sur 5 terminées</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-success/20 bg-gradient-to-br from-success/10 to-success/5 hover:shadow-lg transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-success/20 rounded-lg">
                    <CreditCard className="w-6 h-6 text-success" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Budget utilisé</p>
                  <p className="text-3xl font-bold text-foreground">{metrics.spentAmount.toLocaleString()}€</p>
                  <Progress value={(metrics.spentAmount / metrics.totalBudget) * 100} className="mt-3 h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Reste {metrics.remainingBudget.toLocaleString()}€ sur {metrics.totalBudget.toLocaleString()}€
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-gradient-to-br from-warning/10 to-warning/5 hover:shadow-lg transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-warning/20 rounded-lg">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <AlertTriangle className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Planning</p>
                  <p className="text-3xl font-bold text-foreground">{metrics.delayDays}</p>
                  <p className="text-sm text-warning font-medium">jours de retard</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Rattrapage prévu semaine prochaine
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-info/20 bg-gradient-to-br from-info/10 to-info/5 hover:shadow-lg transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-info/20 rounded-lg">
                    <FileText className="w-6 h-6 text-info" />
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground hover:text-info cursor-pointer" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Qualité TORP</p>
                  <p className="text-3xl font-bold text-foreground">{metrics.qualityScore}</p>
                  <Badge className="bg-success/20 text-success border-success text-xs mt-2">
                    Score A+ avec CCTP
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">96/100 points</p>
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
                      <Dialog key={milestone.id}>
                        <DialogTrigger asChild>
                          <div className="flex items-start gap-4 p-4 border rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer group">
                            <div className="flex-shrink-0 mt-1">
                              {getStatusIcon(milestone.status)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium group-hover:text-primary transition-colors">
                                  {milestone.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={getStatusColor(milestone.status)}>
                                    {milestone.status === 'completed' ? 'Terminé' : 
                                     milestone.status === 'in-progress' ? 'En cours' : 'À venir'}
                                  </Badge>
                                  <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {milestone.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {milestone.status === 'completed' && milestone.completionDate ? (
                                    <span className="text-success">✓ Terminé le {milestone.completionDate}</span>
                                  ) : (
                                    <span>📅 Prévu le {milestone.date}</span>
                                  )}
                                </div>
                                {milestone.status === 'completed' && (
                                  <div className="flex items-center gap-1">
                                    <Camera className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">3 photos</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <ProjectDetailDialog milestone={milestone} />
                      </Dialog>
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
                      <div key={order.id} className="group border rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(order.status)}
                            <div>
                              <h4 className="font-medium group-hover:text-primary transition-colors">
                                {order.item}
                              </h4>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{order.supplier}</span>
                                <span>•</span>
                                <span>Qté: {order.quantity}</span>
                                <span>•</span>
                                <span className="font-semibold text-primary">{order.price}€</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs text-muted-foreground">
                                  {order.deliveryDate}
                                </span>
                                {order.status === 'shipped' && (
                                  <>
                                    <span className="text-xs">•</span>
                                    <MapPin className="w-3 h-3 text-info" />
                                    <span className="text-xs text-info">En transit</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getStatusColor(order.status)}>
                              {order.status === 'ordered' ? 'Commandé' :
                               order.status === 'shipped' ? 'Expédié' : 'Livré'}
                            </Badge>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {order.status === 'shipped' && (
                          <div className="px-4 pb-4">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-info h-2 rounded-full w-3/4 transition-all"></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Livraison prévue dans 2 jours
                            </p>
                          </div>
                        )}
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
                      <Dialog key={artisan.id}>
                        <div className="p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/30 transition-all group">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm group-hover:text-primary">
                              {artisan.name}
                            </h4>
                            <Badge variant="outline" className={getStatusColor(artisan.status)}>
                              {artisan.status === 'active' ? 'Actif' :
                               artisan.status === 'completed' ? 'Terminé' : 'En attente'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Building className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{artisan.specialty}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{artisan.contact}</span>
                          </div>
                          <div className="flex gap-2">
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="flex-1">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Message
                              </Button>
                            </DialogTrigger>
                            <Button size="sm" variant="outline">
                              <Phone className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <ArtisanDetailDialog artisan={artisan} />
                      </Dialog>
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
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto p-3 flex flex-col gap-2">
                      <Camera className="w-5 h-5 text-primary" />
                      <span className="text-xs">Photos</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-3 flex flex-col gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      <span className="text-xs">Problème</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-3 flex flex-col gap-2">
                      <FileText className="w-5 h-5 text-info" />
                      <span className="text-xs">CCTP</span>
                    </Button>
                    <Button variant="outline" className="h-auto p-3 flex flex-col gap-2" 
                            onClick={() => navigate('/financing')}>
                      <Building className="w-5 h-5 text-success" />
                      <span className="text-xs">Financement</span>
                    </Button>
                  </div>
                  
                  <Button className="w-full mt-4" variant="default">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le rapport
                  </Button>
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