import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { 
  Users, 
  TrendingUp, 
  Star,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Euro,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Download,
  Send,
  Eye,
  BarChart3,
  Target,
  Award
} from "lucide-react";
import { toast } from "sonner";

interface Client {
  id: number;
  name: string;
  type: 'acquéreur' | 'investisseur' | 'copropriété' | 'premium';
  phone: string;
  email: string;
  location: string;
  since: string;
  totalAnalyses: number;
  totalValue: number;
  savedAmount: number;
  satisfaction: number;
  status: 'active' | 'pending' | 'inactive';
  lastContact: string;
  projects: {
    name: string;
    date: string;
    amount: number;
    score: string;
    status: 'completed' | 'in-progress' | 'planned';
  }[];
}

export function ClientPortfolio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const clients: Client[] = [
    {
      id: 1,
      name: "M. et Mme Dupont",
      type: 'acquéreur',
      phone: "06 12 34 56 78",
      email: "dupont@email.com",
      location: "Paris 16e",
      since: "2023-06-15",
      totalAnalyses: 4,
      totalValue: 89000,
      savedAmount: 8500,
      satisfaction: 5,
      status: 'active',
      lastContact: "2024-02-10",
      projects: [
        { name: "Rénovation cuisine", date: "2024-01-15", amount: 24500, score: "A-", status: 'completed' },
        { name: "Isolation combles", date: "2024-02-10", amount: 18000, score: "A", status: 'in-progress' }
      ]
    },
    {
      id: 2,
      name: "Copropriété Les Jardins",
      type: 'copropriété',
      phone: "01 45 67 89 00",
      email: "syndic@lesjardins.fr",
      location: "Versailles",
      since: "2023-03-20",
      totalAnalyses: 12,
      totalValue: 345000,
      savedAmount: 45000,
      satisfaction: 4.8,
      status: 'active',
      lastContact: "2024-02-15",
      projects: [
        { name: "Ravalement façade", date: "2023-11-01", amount: 67800, score: "B+", status: 'completed' },
        { name: "Toiture", date: "2024-01-20", amount: 125000, score: "A", status: 'in-progress' },
        { name: "Chauffage collectif", date: "2024-03-01", amount: 89000, score: "-", status: 'planned' }
      ]
    },
    {
      id: 3,
      name: "M. Rousseau",
      type: 'investisseur',
      phone: "06 98 76 54 32",
      email: "rousseau.invest@email.com",
      location: "Neuilly-sur-Seine",
      since: "2023-09-10",
      totalAnalyses: 8,
      totalValue: 456000,
      savedAmount: 52000,
      satisfaction: 5,
      status: 'active',
      lastContact: "2024-02-18",
      projects: [
        { name: "Rénovation T3", date: "2023-12-05", amount: 45000, score: "A", status: 'completed' },
        { name: "Extension maison", date: "2024-01-10", amount: 125000, score: "A-", status: 'in-progress' },
        { name: "Studio neuf", date: "2024-02-20", amount: 28000, score: "B+", status: 'in-progress' }
      ]
    },
    {
      id: 4,
      name: "Mme Martin",
      type: 'premium',
      phone: "06 11 22 33 44",
      email: "martin.claire@email.com",
      location: "Saint-Cloud",
      since: "2023-01-05",
      totalAnalyses: 15,
      totalValue: 678000,
      savedAmount: 89000,
      satisfaction: 4.9,
      status: 'active',
      lastContact: "2024-02-20",
      projects: [
        { name: "Villa complète", date: "2023-06-01", amount: 245000, score: "A", status: 'completed' },
        { name: "Piscine & terrasse", date: "2024-01-15", amount: 78000, score: "A-", status: 'completed' }
      ]
    },
    {
      id: 5,
      name: "M. Bernard",
      type: 'acquéreur',
      phone: "06 55 66 77 88",
      email: "bernard@email.com",
      location: "Boulogne",
      since: "2024-01-10",
      totalAnalyses: 2,
      totalValue: 32000,
      savedAmount: 3800,
      satisfaction: 4.5,
      status: 'pending',
      lastContact: "2024-02-05",
      projects: [
        { name: "Cuisine équipée", date: "2024-02-01", amount: 18200, score: "A", status: 'completed' }
      ]
    }
  ];

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'acquéreur':
        return { label: 'Acquéreur', color: 'bg-blue-500/10 text-blue-700', icon: '🏠' };
      case 'investisseur':
        return { label: 'Investisseur', color: 'bg-purple-500/10 text-purple-700', icon: '💼' };
      case 'copropriété':
        return { label: 'Copropriété', color: 'bg-green-500/10 text-green-700', icon: '🏢' };
      case 'premium':
        return { label: 'Premium', color: 'bg-orange-500/10 text-orange-700', icon: '⭐' };
      default:
        return { label: type, color: '', icon: '👤' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Actif', color: 'bg-green-500/10 text-green-700 hover:bg-green-500/20' };
      case 'pending':
        return { label: 'En attente', color: 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20' };
      case 'inactive':
        return { label: 'Inactif', color: 'bg-gray-500/10 text-gray-700 hover:bg-gray-500/20' };
      default:
        return { label: status, color: '' };
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || client.type === selectedType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    totalValue: clients.reduce((acc, c) => acc + c.totalValue, 0),
    totalSaved: clients.reduce((acc, c) => acc + c.savedAmount, 0),
    avgSatisfaction: clients.reduce((acc, c) => acc + c.satisfaction, 0) / clients.length
  };

  const handleContact = (client: Client) => {
    toast.success(`Email envoyé à ${client.name}`);
  };

  const handleCall = (client: Client) => {
    toast.info(`Appel vers ${client.phone}`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header Stats */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Users className="h-6 w-6" />
            Portefeuille Clients
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Gestion et suivi de vos clients prescripteurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Clients totaux</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <p className="text-sm text-muted-foreground">Actifs</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{(stats.totalValue / 1000).toFixed(0)}k€</div>
              <p className="text-sm text-muted-foreground">Valeur totale</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{(stats.totalSaved / 1000).toFixed(0)}k€</div>
              <p className="text-sm text-muted-foreground">Économies générées</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.avgSatisfaction.toFixed(1)}/5</div>
              <p className="text-sm text-muted-foreground">Satisfaction moy.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('all')}
          >
            Tous
          </Button>
          <Button
            variant={selectedType === 'acquéreur' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('acquéreur')}
          >
            🏠 Acquéreurs
          </Button>
          <Button
            variant={selectedType === 'investisseur' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('investisseur')}
          >
            💼 Investisseurs
          </Button>
          <Button
            variant={selectedType === 'copropriété' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('copropriété')}
          >
            🏢 Copropriétés
          </Button>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
        </Button>
      </div>

      {/* Clients Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => {
          const typeConfig = getTypeConfig(client.type);
          const statusConfig = getStatusConfig(client.status);
          return (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{typeConfig.icon}</span>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < client.satisfaction ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Contact Info */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{client.location}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Analyses</p>
                    <p className="font-semibold">{client.totalAnalyses}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valeur</p>
                    <p className="font-semibold">{(client.totalValue / 1000).toFixed(0)}k€</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Économies</p>
                    <p className="font-semibold text-green-600">{(client.savedAmount / 1000).toFixed(1)}k€</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client depuis</p>
                    <p className="font-semibold text-xs">{new Date(client.since).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Projets récents</p>
                  <div className="space-y-1">
                    {client.projects.slice(0, 2).map((project, idx) => (
                      <div key={idx} className="text-xs flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="truncate flex-1">{project.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {project.score}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCall(client)}
                  >
                    <Phone className="w-3 h-3 mr-1" />
                    Appeler
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleContact(client)}
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>

                {/* Last Contact */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Dernier contact</span>
                  </div>
                  <span>{new Date(client.lastContact).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucun client trouvé</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}