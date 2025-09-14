import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  Euro, 
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart,
  LineChart,
  Zap,
  Phone,
  Mail,
  Calendar,
  Filter
} from 'lucide-react';

interface AnalyticsProps {
  userType: 'B2B' | 'B2C' | 'B2G' | 'B2B2C';
}

export function AdvancedAnalytics({ userType }: AnalyticsProps) {
  const b2bMetrics = {
    scoreMoyen: 7.8,
    tauxConversion: 34.2,
    leadsMois: 127,
    pipelineValue: 456780,
    clientsActifs: 89,
    projetsEnCours: 23,
    ca3Mois: 187500,
    margeMovenne: 28.5,
    satisfactionClient: 4.7,
    tempsReponse: 2.3
  };

  const conversionFunnel = [
    { stage: 'Leads générés', value: 127, percentage: 100 },
    { stage: 'Devis envoyés', value: 98, percentage: 77 },
    { stage: 'Négociations', value: 56, percentage: 44 },
    { stage: 'Projets signés', value: 34, percentage: 27 }
  ];

  const topClients = [
    { name: 'Résidences Premium', ca: 45600, projets: 12, score: 8.9 },
    { name: 'Groupe Immobilier Sud', ca: 38900, projets: 8, score: 8.7 },
    { name: 'Syndic Parisien Pro', ca: 29400, projets: 15, score: 8.4 },
    { name: 'Constructeur Moderne', ca: 25800, projets: 6, score: 9.1 }
  ];

  const recentLeads = [
    {
      client: 'Villa Moderne SARL',
      projet: 'Rénovation énergétique',
      valeur: 67000,
      statut: 'Négociation',
      probability: 75,
      echeance: '2024-02-15',
      contact: 'M. Durand'
    },
    {
      client: 'Copro Les Jardins',
      projet: 'Ravalement façade',
      valeur: 124000,
      statut: 'Devis envoyé',
      probability: 60,
      echeance: '2024-02-20',
      contact: 'Mme Martin'
    },
    {
      client: 'Entreprise Bâti+',
      projet: 'Extension bureaux',
      valeur: 89500,
      statut: 'Premier contact',
      probability: 30,
      echeance: '2024-03-01',
      contact: 'M. Lefebvre'
    }
  ];

  const renderB2BDashboard = () => (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-foreground">{b2bMetrics.scoreMoyen}</div>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xs text-muted-foreground">Score TORP moyen</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs text-success">+0.3 ce mois</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-foreground">{b2bMetrics.tauxConversion}%</div>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="text-xs text-muted-foreground">Taux conversion</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs text-success">+2.1% ce mois</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-foreground">{b2bMetrics.leadsMois}</div>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xs text-muted-foreground">Leads ce mois</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs text-success">+18 vs mois dernier</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-foreground">{(b2bMetrics.pipelineValue / 1000).toFixed(0)}k€</div>
              <Euro className="h-4 w-4 text-warning" />
            </div>
            <div className="text-xs text-muted-foreground">Pipeline value</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs text-success">+12% ce mois</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold text-foreground">{b2bMetrics.satisfactionClient}</div>
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            <div className="text-xs text-muted-foreground">Satisfaction /5</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs text-success">+0.2 ce mois</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel de conversion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Funnel de conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversionFunnel.map((stage, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{stage.stage}</span>
                    <span className="font-medium">{stage.value} ({stage.percentage}%)</span>
                  </div>
                  <Progress value={stage.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top clients actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topClients.map((client, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{client.name}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>CA: {client.ca.toLocaleString()}€</span>
                      <span>Projets: {client.projets}</span>
                      <Badge variant="outline" className="text-xs">
                        Score: {client.score}/10
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline et leads récents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Pipeline commercial - Leads actifs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtrer
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Planifier relance
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentLeads.map((lead, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{lead.client}</h4>
                      <Badge variant={
                        lead.statut === 'Négociation' ? 'default' :
                        lead.statut === 'Devis envoyé' ? 'warning' :
                        'secondary'
                      }>
                        {lead.statut}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{lead.projet}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Valeur: </span>
                        <span className="font-medium">{lead.valeur.toLocaleString()}€</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Probabilité: </span>
                        <span className="font-medium text-success">{lead.probability}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Échéance: </span>
                        <span className="font-medium">{lead.echeance}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contact: </span>
                        <span className="font-medium">{lead.contact}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-1" />
                      Appeler
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                    <Button size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      Devis
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progression</span>
                    <span>{lead.probability}%</span>
                  </div>
                  <Progress value={lead.probability} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Graphiques et tendances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Évolution CA mensuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Graphique CA des 12 derniers mois
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Répartition par secteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Graphique répartition clients par secteur
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assistant IA pour B2B */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Assistant Commercial IA - Recommandations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-background/50 rounded-lg">
              <h4 className="font-medium mb-2 text-success">Opportunité détectée</h4>
              <p className="text-sm text-muted-foreground mb-2">
                3 prospects chauds n'ont pas été recontactés depuis 5 jours. Relance recommandée.
              </p>
              <Button variant="outline" size="sm">
                Planifier relances
              </Button>
            </div>
            <div className="p-4 bg-background/50 rounded-lg">
              <h4 className="font-medium mb-2 text-warning">Point d'attention</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Délai de réponse moyen en hausse (+0.8h). Optimisation process recommandée.
              </p>
              <Button variant="outline" size="sm">
                Analyser les causes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  switch (userType) {
    case 'B2B':
      return renderB2BDashboard();
    case 'B2C':
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics B2C</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics spécialisés pour les particuliers à développer</p>
            </CardContent>
          </Card>
        </div>
      );
    case 'B2G':
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics B2G</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics pour collectivités disponibles dans le dashboard dédié</p>
            </CardContent>
          </Card>
        </div>
      );
    case 'B2B2C':
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics B2B2C</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics pour prescripteurs disponibles dans le dashboard dédié</p>
            </CardContent>
          </Card>
        </div>
      );
    default:
      return null;
  }
}