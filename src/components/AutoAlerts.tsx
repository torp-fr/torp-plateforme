import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { 
  AlertTriangle, 
  Shield,
  TrendingUp,
  Euro,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Bell,
  Target,
  BarChart3,
  Activity,
  Zap,
  AlertCircle,
  FileText,
  Users,
  MapPin
} from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: number;
  type: 'fraud' | 'price' | 'quality' | 'delay' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  project: string;
  contractor: string;
  amount: number;
  detectedDate: string;
  status: 'new' | 'investigating' | 'resolved' | 'dismissed';
  confidence: number;
  evidence: string[];
  recommendation: string;
  potentialSaving?: number;
  quartier: string;
}

export function AutoAlerts() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const alerts: Alert[] = [
    {
      id: 1,
      type: 'fraud',
      severity: 'critical',
      title: "Acompte suspect de 65% demandé",
      description: "L'entreprise demande un acompte de 65% alors que la norme est de 30% maximum pour ce type de travaux",
      project: "Rénovation École Maternelle",
      contractor: "BatiRapide SARL",
      amount: 85000,
      detectedDate: "2024-02-20",
      status: 'new',
      confidence: 94,
      evidence: [
        "Acompte 65% vs norme 30%",
        "Entreprise créée il y a 3 mois",
        "Pas de références vérifiables",
        "Coordonnées bancaires suspectes"
      ],
      recommendation: "URGENT : Suspendre le paiement et lancer une vérification approfondie de l'entreprise",
      potentialSaving: 55250,
      quartier: "Centre-Ville"
    },
    {
      id: 2,
      type: 'price',
      severity: 'high',
      title: "Prix matériaux +45% au-dessus du marché",
      description: "Le devis facture les matériaux d'isolation 45% plus cher que le prix marché constaté",
      project: "Isolation Gymnase Municipal",
      contractor: "IsoTech Pro",
      amount: 125000,
      detectedDate: "2024-02-19",
      status: 'investigating',
      confidence: 87,
      evidence: [
        "Prix laine de verre : 28€/m² vs 19€/m² marché",
        "Majorations inexpliquées sur pose",
        "Pas de justificatif technique"
      ],
      recommendation: "Demander renégociation du poste matériaux ou mise en concurrence",
      potentialSaving: 23400,
      quartier: "Quartier Nord"
    },
    {
      id: 3,
      type: 'quality',
      severity: 'high',
      title: "Non-conformité DTU détectée",
      description: "Les spécifications techniques ne respectent pas les normes DTU pour la rénovation énergétique",
      project: "Rénovation Mairie Annexe",
      contractor: "RénoBât Express",
      amount: 245000,
      detectedDate: "2024-02-18",
      status: 'new',
      confidence: 92,
      evidence: [
        "Absence de pare-vapeur (DTU 31.2)",
        "Épaisseur isolation insuffisante",
        "Ventilation non prévue (réglementaire)"
      ],
      recommendation: "Exiger mise en conformité DTU avant signature",
      quartier: "Zone Sud"
    },
    {
      id: 4,
      type: 'delay',
      severity: 'medium',
      title: "Délais sous-estimés de 40%",
      description: "Le planning proposé est 40% plus court que la durée standard pour ce type de chantier",
      project: "Voirie Rue des Écoles",
      contractor: "TP Moderne",
      amount: 180000,
      detectedDate: "2024-02-17",
      status: 'investigating',
      confidence: 78,
      evidence: [
        "Planning 12 semaines vs 20 semaines standard",
        "Effectif prévu insuffisant",
        "Pas de buffer pour intempéries"
      ],
      recommendation: "Demander planning réaliste avec phases détaillées",
      quartier: "Quartier Est"
    },
    {
      id: 5,
      type: 'compliance',
      severity: 'high',
      title: "Certifications obligatoires manquantes",
      description: "L'entreprise n'a pas fourni les certifications RGE obligatoires pour bénéficier des aides",
      project: "Chauffage Piscine Municipale",
      contractor: "ThermoPro Services",
      amount: 95000,
      detectedDate: "2024-02-16",
      status: 'new',
      confidence: 100,
      evidence: [
        "Absence certification RGE",
        "Qualification QualiPAC manquante",
        "Risque perte aides État (30%)"
      ],
      recommendation: "BLOQUER : Exiger certifications avant toute signature",
      potentialSaving: 28500,
      quartier: "Zone Ouest"
    },
    {
      id: 6,
      type: 'price',
      severity: 'medium',
      title: "Marge excessive détectée",
      description: "La marge de l'entreprise est estimée à 35% vs 15-20% standard pour ce type de travaux",
      project: "Éclairage Public LED",
      contractor: "LumièreCity",
      amount: 145000,
      detectedDate: "2024-02-15",
      status: 'resolved',
      confidence: 82,
      evidence: [
        "Coûts matériaux vérifiés : 85k€",
        "Main d'œuvre estimée : 25k€",
        "Marge calculée : 35k€ (35%)"
      ],
      recommendation: "Négocier marge à 20% max",
      potentialSaving: 21750,
      quartier: "Centre-Ville"
    },
    {
      id: 7,
      type: 'fraud',
      severity: 'critical',
      title: "Entreprise avec antécédents judiciaires",
      description: "L'entreprise candidate a des antécédents de non-respect de contrats publics",
      project: "Crèche Municipale",
      contractor: "Enfance & Travaux",
      amount: 380000,
      detectedDate: "2024-02-14",
      status: 'dismissed',
      confidence: 96,
      evidence: [
        "2 condamnations tribunaux de commerce",
        "Litige en cours avec collectivité voisine",
        "Changement de raison sociale récent"
      ],
      recommendation: "ÉCARTER du processus de sélection",
      quartier: "Quartier Nord"
    },
    {
      id: 8,
      type: 'quality',
      severity: 'low',
      title: "Garanties incomplètes",
      description: "Les garanties décennale et biennale ne sont pas explicitement mentionnées",
      project: "Stade Municipal",
      contractor: "SportBat",
      amount: 520000,
      detectedDate: "2024-02-13",
      status: 'resolved',
      confidence: 71,
      evidence: [
        "Pas de mention garantie décennale",
        "Clause garanties floue",
        "Numéro police assurance manquant"
      ],
      recommendation: "Exiger attestations garanties avant signature",
      quartier: "Zone Sud"
    }
  ];

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'fraud':
        return { label: 'Fraude', color: 'bg-red-500/10 text-red-700', icon: AlertTriangle };
      case 'price':
        return { label: 'Prix', color: 'bg-orange-500/10 text-orange-700', icon: Euro };
      case 'quality':
        return { label: 'Qualité', color: 'bg-yellow-500/10 text-yellow-700', icon: Shield };
      case 'delay':
        return { label: 'Délais', color: 'bg-blue-500/10 text-blue-700', icon: Clock };
      case 'compliance':
        return { label: 'Conformité', color: 'bg-purple-500/10 text-purple-700', icon: FileText };
      default:
        return { label: type, color: '', icon: AlertCircle };
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { label: 'Critique', color: 'bg-red-600 text-white', icon: '🚨' };
      case 'high':
        return { label: 'Élevée', color: 'bg-orange-600 text-white', icon: '⚠️' };
      case 'medium':
        return { label: 'Moyenne', color: 'bg-yellow-600 text-white', icon: '⚡' };
      case 'low':
        return { label: 'Faible', color: 'bg-blue-600 text-white', icon: 'ℹ️' };
      default:
        return { label: severity, color: '', icon: '📋' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'new':
        return { label: 'Nouveau', color: 'bg-red-500/10 text-red-700' };
      case 'investigating':
        return { label: 'Enquête', color: 'bg-blue-500/10 text-blue-700' };
      case 'resolved':
        return { label: 'Résolu', color: 'bg-green-500/10 text-green-700' };
      case 'dismissed':
        return { label: 'Écarté', color: 'bg-gray-500/10 text-gray-700' };
      default:
        return { label: status, color: '' };
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesType = selectedFilter === 'all' || alert.type === selectedFilter;
    const matchesSeverity = selectedSeverity === 'all' || alert.severity === selectedSeverity;
    return matchesType && matchesSeverity;
  });

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    new: alerts.filter(a => a.status === 'new').length,
    totalSaving: alerts.filter(a => a.potentialSaving).reduce((acc, a) => acc + (a.potentialSaving || 0), 0),
    avgConfidence: Math.round(alerts.reduce((acc, a) => acc + a.confidence, 0) / alerts.length)
  };

  const handleInvestigate = (alertId: number) => {
    toast.info("Enquête lancée sur cette alerte");
  };

  const handleResolve = (alertId: number) => {
    toast.success("Alerte marquée comme résolue");
  };

  const handleDismiss = (alertId: number) => {
    toast.info("Alerte écartée");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-red-600" />
                Système d'Alertes Automatiques
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Détection en temps réel des anomalies et risques sur les devis publics
              </CardDescription>
            </div>
            <Badge className="bg-red-500/10 text-red-700 text-lg px-4 py-2">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {stats.new} nouvelles alertes
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <p className="text-sm text-muted-foreground">Critiques</p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.new}</div>
              <p className="text-sm text-muted-foreground">Nouvelles</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{(stats.totalSaving / 1000).toFixed(0)}k€</div>
              <p className="text-sm text-muted-foreground">Économies pot.</p>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.avgConfidence}%</div>
              <p className="text-sm text-muted-foreground">Confiance moy.</p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total alertes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('all')}
          >
            Toutes
          </Button>
          <Button
            variant={selectedFilter === 'fraud' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('fraud')}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Fraudes
          </Button>
          <Button
            variant={selectedFilter === 'price' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('price')}
          >
            <Euro className="w-4 h-4 mr-2" />
            Prix
          </Button>
          <Button
            variant={selectedFilter === 'quality' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('quality')}
          >
            <Shield className="w-4 h-4 mr-2" />
            Qualité
          </Button>
          <Button
            variant={selectedFilter === 'compliance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedFilter('compliance')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Conformité
          </Button>
        </div>
        <div className="border-l pl-4 flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Gravité:</span>
          <Button
            variant={selectedSeverity === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSeverity('all')}
          >
            Toutes
          </Button>
          <Button
            variant={selectedSeverity === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSeverity('critical')}
          >
            🚨 Critique
          </Button>
          <Button
            variant={selectedSeverity === 'high' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSeverity('high')}
          >
            ⚠️ Élevée
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.map(alert => {
          const typeConfig = getTypeConfig(alert.type);
          const severityConfig = getSeverityConfig(alert.severity);
          const statusConfig = getStatusConfig(alert.status);
          const TypeIcon = typeConfig.icon;

          return (
            <Card 
              key={alert.id} 
              className={`hover:shadow-md transition-shadow ${
                alert.severity === 'critical' ? 'border-red-500/50' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <TypeIcon className="w-5 h-5 text-muted-foreground" />
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                      <Badge className={severityConfig.color}>
                        {severityConfig.icon} {severityConfig.label}
                      </Badge>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      {alert.status === 'new' && (
                        <Badge variant="destructive" className="animate-pulse">NOUVEAU</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mb-1">{alert.title}</CardTitle>
                    <CardDescription>{alert.description}</CardDescription>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-red-600">{alert.confidence}%</div>
                    <p className="text-xs text-muted-foreground">Confiance</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project Info */}
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Projet</p>
                    <p className="font-medium text-sm">{alert.project}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Entreprise</p>
                    <p className="font-medium text-sm">{alert.contractor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Montant</p>
                    <p className="font-medium text-sm">{alert.amount.toLocaleString()}€</p>
                  </div>
                </div>

                {/* Evidence */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Éléments détectés
                  </p>
                  <div className="space-y-1">
                    {alert.evidence.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-950/20 rounded">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Recommandation</p>
                      <p className="text-sm text-muted-foreground">{alert.recommendation}</p>
                    </div>
                  </div>
                </div>

                {/* Potential Saving */}
                {alert.potentialSaving && (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Économie potentielle</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">
                      {alert.potentialSaving.toLocaleString()}€
                    </span>
                  </div>
                )}

                {/* Confidence Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Niveau de confiance</span>
                    <span className="font-medium">{alert.confidence}%</span>
                  </div>
                  <Progress value={alert.confidence} className="h-2" />
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{alert.quartier}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Détecté le {alert.detectedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {alert.status === 'new' && (
                    <>
                      <Button className="flex-1" onClick={() => handleInvestigate(alert.id)}>
                        <Activity className="w-4 h-4 mr-2" />
                        Enquêter
                      </Button>
                      <Button variant="outline" onClick={() => handleResolve(alert.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Résoudre
                      </Button>
                    </>
                  )}
                  {alert.status === 'investigating' && (
                    <Button className="flex-1" onClick={() => handleResolve(alert.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marquer résolu
                    </Button>
                  )}
                  {(alert.status === 'resolved' || alert.status === 'dismissed') && (
                    <Button variant="outline" className="flex-1" disabled>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {alert.status === 'resolved' ? 'Résolu' : 'Écarté'}
                    </Button>
                  )}
                  <Button variant="outline">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={() => handleDismiss(alert.id)}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                  <Button variant="outline">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Info */}
      <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium mb-1">🤖 Détection automatique 24/7</h4>
              <p className="text-sm text-muted-foreground">
                L'IA TORP analyse chaque devis public en temps réel en croisant : bases de données judiciaires, 
                historiques de prix, normes techniques (DTU), certifications, et détecte automatiquement 
                les anomalies, fraudes potentielles et non-conformités pour protéger l'argent public.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}