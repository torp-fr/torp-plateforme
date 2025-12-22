import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCarnet } from '@/hooks/phase5/useCarnet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCheck, AlertTriangle, Calendar, Upload,
  CheckCircle2, Clock, XCircle, FileText,
  Thermometer, Zap, Droplets, Bug, Radio
} from 'lucide-react';
import { format, differenceInDays, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Diagnostic {
  id: string;
  type: string;
  nom: string;
  description: string;
  validite_annees: number;
  obligatoire: boolean;
  date_realisation?: string;
  date_expiration?: string;
  statut: 'valide' | 'expire' | 'a_faire' | 'bientot_expire';
  document_url?: string;
  diagnostiqueur?: string;
  numero_certification?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DIAGNOSTICS_OBLIGATOIRES: Omit<Diagnostic, 'id' | 'date_realisation' | 'date_expiration' | 'statut' | 'document_url' | 'diagnostiqueur' | 'numero_certification'>[] = [
  {
    type: 'DPE',
    nom: 'Diagnostic de Performance Énergétique',
    description: 'Évalue la consommation énergétique et les émissions de GES du logement',
    validite_annees: 10,
    obligatoire: true,
    icon: Thermometer,
  },
  {
    type: 'ELECTRICITE',
    nom: 'Diagnostic Électricité',
    description: 'Contrôle l\'état de l\'installation électrique intérieure (> 15 ans)',
    validite_annees: 3,
    obligatoire: true,
    icon: Zap,
  },
  {
    type: 'GAZ',
    nom: 'Diagnostic Gaz',
    description: 'Contrôle l\'état de l\'installation gaz intérieure (> 15 ans)',
    validite_annees: 3,
    obligatoire: true,
    icon: Droplets,
  },
  {
    type: 'AMIANTE',
    nom: 'Diagnostic Amiante',
    description: 'Recherche de matériaux contenant de l\'amiante (bâtiments avant 1997)',
    validite_annees: -1, // Illimité si négatif
    obligatoire: true,
    icon: AlertTriangle,
  },
  {
    type: 'PLOMB',
    nom: 'Constat de Risque d\'Exposition au Plomb (CREP)',
    description: 'Recherche de peintures au plomb (bâtiments avant 1949)',
    validite_annees: 1, // 1 an vente, 6 ans location
    obligatoire: true,
    icon: AlertTriangle,
  },
  {
    type: 'TERMITES',
    nom: 'État Relatif aux Termites',
    description: 'Recherche de termites dans les zones à risque',
    validite_annees: 0.5, // 6 mois
    obligatoire: false,
    icon: Bug,
  },
  {
    type: 'ERP',
    nom: 'État des Risques et Pollutions',
    description: 'Risques naturels, miniers, technologiques, sismiques, radon',
    validite_annees: 0.5, // 6 mois
    obligatoire: true,
    icon: Radio,
  },
  {
    type: 'CARREZ',
    nom: 'Mesurage Loi Carrez',
    description: 'Surface privative du lot de copropriété',
    validite_annees: -1, // Illimité sauf travaux
    obligatoire: true,
    icon: FileText,
  },
];

export function DiagnosticsPage() {
  const { projectId } = useParams();
  const { carnet, diagnostics, addDiagnostic, isLoading } = useCarnet(projectId!);
  const [activeTab, setActiveTab] = useState('tous');

  // Calculer le statut de chaque diagnostic
  const getDiagnosticStatus = (diag: Diagnostic): Diagnostic['statut'] => {
    if (!diag.date_realisation) return 'a_faire';
    if (diag.validite_annees === -1) return 'valide'; // Illimité

    const expiration = addYears(new Date(diag.date_realisation), diag.validite_annees);
    const joursRestants = differenceInDays(expiration, new Date());

    if (joursRestants < 0) return 'expire';
    if (joursRestants < 90) return 'bientot_expire';
    return 'valide';
  };

  // Enrichir les diagnostics avec leur statut
  const diagnosticsEnrichis: Diagnostic[] = DIAGNOSTICS_OBLIGATOIRES.map((d, index) => {
    const existant = diagnostics?.find(diag => diag.type === d.type);
    return {
      ...d,
      id: existant?.id || `diag-${index}`,
      date_realisation: existant?.date_realisation,
      date_expiration: existant?.date_realisation && d.validite_annees > 0
        ? format(addYears(new Date(existant.date_realisation), d.validite_annees), 'yyyy-MM-dd')
        : undefined,
      statut: existant ? getDiagnosticStatus({ ...d, ...existant } as Diagnostic) : 'a_faire',
      document_url: existant?.document_url,
      diagnostiqueur: existant?.diagnostiqueur,
      numero_certification: existant?.numero_certification,
    };
  });

  // Stats
  const stats = {
    total: diagnosticsEnrichis.length,
    valides: diagnosticsEnrichis.filter(d => d.statut === 'valide').length,
    expires: diagnosticsEnrichis.filter(d => d.statut === 'expire').length,
    aFaire: diagnosticsEnrichis.filter(d => d.statut === 'a_faire').length,
    bientotExpires: diagnosticsEnrichis.filter(d => d.statut === 'bientot_expire').length,
  };

  const completionRate = Math.round((stats.valides / stats.total) * 100);

  const getStatusBadge = (statut: Diagnostic['statut']) => {
    switch (statut) {
      case 'valide':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Valide</Badge>;
      case 'expire':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expiré</Badge>;
      case 'bientot_expire':
        return <Badge className="bg-orange-100 text-orange-800"><Clock className="h-3 w-3 mr-1" />Expire bientôt</Badge>;
      case 'a_faire':
        return <Badge variant="outline"><FileCheck className="h-3 w-3 mr-1" />À réaliser</Badge>;
    }
  };

  const filteredDiagnostics = activeTab === 'tous'
    ? diagnosticsEnrichis
    : diagnosticsEnrichis.filter(d => d.statut === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 5</Badge>
            <Badge variant="outline">Diagnostics</Badge>
          </div>
          <h1 className="text-3xl font-bold">Diagnostics Obligatoires</h1>
          <p className="text-muted-foreground">
            Gérez les diagnostics immobiliers de votre bien
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Importer un diagnostic
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">Complétude</p>
              </div>
              <Progress value={completionRate} className="w-16 h-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.valides}</p>
                <p className="text-sm text-muted-foreground">Valides</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.bientotExpires}</p>
                <p className="text-sm text-muted-foreground">Expire bientôt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.expires}</p>
                <p className="text-sm text-muted-foreground">Expirés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FileCheck className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aFaire}</p>
                <p className="text-sm text-muted-foreground">À réaliser</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      {(stats.expires > 0 || stats.bientotExpires > 0) && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">Attention requise</p>
                <p className="text-sm text-orange-700">
                  {stats.expires > 0 && `${stats.expires} diagnostic(s) expiré(s). `}
                  {stats.bientotExpires > 0 && `${stats.bientotExpires} diagnostic(s) expire(nt) dans moins de 90 jours.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des diagnostics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tous">Tous ({stats.total})</TabsTrigger>
          <TabsTrigger value="valide">Valides ({stats.valides})</TabsTrigger>
          <TabsTrigger value="bientot_expire">Expire bientôt ({stats.bientotExpires})</TabsTrigger>
          <TabsTrigger value="expire">Expirés ({stats.expires})</TabsTrigger>
          <TabsTrigger value="a_faire">À réaliser ({stats.aFaire})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid gap-4">
            {filteredDiagnostics.map(diagnostic => {
              const Icon = diagnostic.icon;
              return (
                <Card key={diagnostic.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <Icon className="h-6 w-6 text-gray-700" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{diagnostic.nom}</h3>
                            <Badge variant="outline" className="text-xs">{diagnostic.type}</Badge>
                            {diagnostic.obligatoire && (
                              <Badge variant="secondary" className="text-xs">Obligatoire</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{diagnostic.description}</p>
                          <div className="flex items-center gap-4 text-sm mt-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Validité : {diagnostic.validite_annees === -1 ? 'Illimitée' : `${diagnostic.validite_annees} an(s)`}
                            </span>
                            {diagnostic.date_realisation && (
                              <span>
                                Réalisé le : {format(new Date(diagnostic.date_realisation), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                            )}
                            {diagnostic.date_expiration && (
                              <span>
                                Expire le : {format(new Date(diagnostic.date_expiration), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(diagnostic.statut)}
                        <Button variant="outline" size="sm">
                          {diagnostic.document_url ? 'Voir' : 'Ajouter'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DiagnosticsPage;
