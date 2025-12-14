/**
 * Phase 1: Consultation & Sélection Entreprises
 * Page principale de gestion de la consultation
 * Adapte l'affichage selon le profil utilisateur (B2C, B2B, B2G)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AppLayout } from '@/components/layout';
import {
  ArrowLeft, FileText, Building2, ClipboardList, Scale, FileCheck,
  Loader2, AlertTriangle, CheckCircle2, Clock, Users, Euro,
  Search, Star, Shield, Award, Send, Eye, Download, Filter
} from 'lucide-react';
import { Phase0ProjectService, Phase0Project } from '@/services/phase0';
import { DCEService } from '@/services/phase1/dce.service';
import { EntrepriseService } from '@/services/phase1/entreprise.service';
import { OffreService } from '@/services/phase1/offre.service';
import { ContratService } from '@/services/phase1/contrat.service';
import { FormalitesService } from '@/services/phase1/formalites.service';
import type { DCEDocument, DCEStatus } from '@/types/phase1/dce.types';
import type { Entreprise, RecommandationEntreprise } from '@/types/phase1/entreprise.types';
import type { Offre, TableauComparatif } from '@/types/phase1/offre.types';
import { useApp, UserType } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

// Configuration selon le type de profil
const PROFILE_CONFIG: Record<UserType, {
  label: string;
  dceLabel: string;
  entrepriseLabel: string;
  offreLabel: string;
  contractLabel: string;
  features: {
    showScoring: boolean;
    showJuridique: boolean;
    showMarchePublic: boolean;
    showSimplified: boolean;
  };
}> = {
  B2C: {
    label: 'Particulier',
    dceLabel: 'Dossier de consultation',
    entrepriseLabel: 'Trouver des artisans',
    offreLabel: 'Comparer les devis',
    contractLabel: 'Contrat',
    features: {
      showScoring: true,
      showJuridique: false,
      showMarchePublic: false,
      showSimplified: true,
    },
  },
  B2B: {
    label: 'Professionnel',
    dceLabel: 'Dossier reçu',
    entrepriseLabel: 'Sous-traitance',
    offreLabel: 'Mon offre',
    contractLabel: 'Contrat',
    features: {
      showScoring: true,
      showJuridique: true,
      showMarchePublic: false,
      showSimplified: false,
    },
  },
  B2G: {
    label: 'Collectivité',
    dceLabel: 'Dossier de Consultation des Entreprises',
    entrepriseLabel: 'Mise en concurrence',
    offreLabel: 'Analyse des candidatures',
    contractLabel: 'Marchés publics',
    features: {
      showScoring: true,
      showJuridique: true,
      showMarchePublic: true,
      showSimplified: false,
    },
  },
  admin: {
    label: 'Admin',
    dceLabel: 'DCE',
    entrepriseLabel: 'Entreprises',
    offreLabel: 'Offres',
    contractLabel: 'Contrats',
    features: {
      showScoring: true,
      showJuridique: true,
      showMarchePublic: true,
      showSimplified: false,
    },
  },
  super_admin: {
    label: 'Super Admin',
    dceLabel: 'DCE',
    entrepriseLabel: 'Entreprises',
    offreLabel: 'Offres',
    contractLabel: 'Contrats',
    features: {
      showScoring: true,
      showJuridique: true,
      showMarchePublic: true,
      showSimplified: false,
    },
  },
};

// Étapes de la consultation selon le profil
const getConsultationSteps = (userType: UserType) => {
  const isB2C = userType === 'B2C';
  const isB2B = userType === 'B2B';
  const isB2G = userType === 'B2G';

  // Étapes spécifiques B2B (réponse à appel d'offres)
  if (isB2B) {
    return [
      {
        id: 'dce',
        label: 'Consulter le dossier',
        description: 'Analysez le DCE reçu et les exigences du maître d\'ouvrage',
        icon: FileText,
      },
      {
        id: 'entreprises',
        label: 'Sous-traitance',
        description: 'Identifiez des sous-traitants si nécessaire pour ce projet',
        icon: Building2,
      },
      {
        id: 'offres',
        label: 'Préparer mon offre',
        description: 'Rédigez votre offre technique et financière',
        icon: ClipboardList,
      },
      {
        id: 'selection',
        label: 'Soumettre',
        description: 'Soumettez votre offre et suivez son évaluation',
        icon: Scale,
      },
      {
        id: 'formalites',
        label: 'Préparation chantier',
        description: 'Si retenu, préparez le démarrage du chantier',
        icon: FileCheck,
      },
    ];
  }

  return [
    {
      id: 'dce',
      label: isB2C ? 'Préparer le dossier' : 'Constitution du DCE',
      description: isB2C
        ? 'Rassemblez les documents pour consulter les artisans'
        : 'Règlement de consultation, CCTP, DPGF, Acte d\'engagement',
      icon: FileText,
    },
    {
      id: 'entreprises',
      label: isB2C ? 'Trouver des artisans' : 'Publication & candidatures',
      description: isB2C
        ? 'Artisans qualifiés RGE et Qualibat près de chez vous'
        : 'Publication sur les plateformes, réception des candidatures',
      icon: Building2,
    },
    {
      id: 'offres',
      label: isB2C ? 'Comparer les devis' : 'Analyse des offres',
      description: isB2C
        ? 'Comparez les prix et les prestations'
        : 'Analyse technique, financière et comparative',
      icon: ClipboardList,
    },
    {
      id: 'selection',
      label: isB2C ? 'Choisir et signer' : 'Attribution du marché',
      description: isB2C
        ? 'Signez votre contrat en toute sécurité'
        : 'Notification, signature du marché public',
      icon: Scale,
    },
    {
      id: 'formalites',
      label: isB2C ? 'Formalités' : 'Préparation administrative',
      description: isB2C
        ? 'Autorisations et démarches avant travaux'
        : 'DICT, déclarations, coordination sécurité',
      icon: FileCheck,
    },
  ];
};

interface ConsultationState {
  status: 'draft' | 'dce_ready' | 'en_consultation' | 'offres_recues' | 'selection' | 'contractualise' | 'formalites' | 'pret';
  currentStep: number;
  dce?: DCEDocument;
  entreprises: RecommandationEntreprise[];
  offres: Offre[];
  tableauComparatif?: TableauComparatif;
}

export function Phase1Consultation() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, userType } = useApp();
  const { toast } = useToast();

  const [project, setProject] = useState<Phase0Project | null>(null);
  const [consultationState, setConsultationState] = useState<ConsultationState>({
    status: 'draft',
    currentStep: 0,
    entreprises: [],
    offres: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const config = PROFILE_CONFIG[userType];
  const steps = getConsultationSteps(userType);

  // Charger le projet Phase 0 et le DCE existant
  useEffect(() => {
    const loadProjectAndDCE = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Charger le projet
        const projectData = await Phase0ProjectService.getProjectById(projectId);
        if (!projectData) {
          setError('Projet non trouvé');
          return;
        }
        setProject(projectData);

        // Charger le DCE existant si présent (ne pas bloquer en cas d'erreur)
        try {
          const existingDCE = await DCEService.getDCEByProjectId(projectId);
          if (existingDCE) {
            setConsultationState(prev => ({
              ...prev,
              status: 'dce_ready',
              currentStep: 1,
              dce: existingDCE,
            }));
          }
        } catch (dceErr) {
          // Erreur normale si table n'existe pas encore ou pas de DCE
          console.log('DCE non disponible:', dceErr instanceof Error ? dceErr.message : 'erreur');
        }
      } catch (err) {
        console.error('Erreur chargement projet:', err);
        setError('Impossible de charger le projet');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectAndDCE();
  }, [projectId]);

  // Générer le DCE
  const handleGenerateDCE = useCallback(async () => {
    if (!project) return;

    setIsProcessing(true);
    try {
      // Adapter le wizardMode selon le type d'utilisateur
      const wizardMode = userType === 'B2C' ? 'b2c_simple' : userType === 'B2G' ? 'b2g_public' : 'b2b_professional';

      // Préparer le projet avec le bon wizardMode
      const projectWithMode = {
        ...project,
        wizardMode,
      };

      const result = await DCEService.generateDCE({
        project: projectWithMode,
        config: {
          includeRC: true,
          includeAE: true,
          includeDPGF: true,
          includeCadreMT: true,
        },
      });

      if (result.success && result.dce) {
        setConsultationState(prev => ({
          ...prev,
          status: 'dce_ready',
          currentStep: 1,
          dce: result.dce,
        }));

        const documentsCount = result.dce.generationInfo?.piecesGenerees?.length || 4;
        toast({
          title: userType === 'B2C' ? 'Dossier préparé' : 'DCE généré',
          description: `${documentsCount} document(s) créé(s)`,
        });
      } else if (result.errors && result.errors.length > 0) {
        toast({
          title: 'Erreur de génération',
          description: result.errors[0],
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Erreur génération DCE:', err);
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de générer le dossier de consultation',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [project, userType, toast]);

  // Rechercher des entreprises
  const handleSearchEntreprises = useCallback(async () => {
    if (!project) return;

    setIsProcessing(true);
    try {
      // Adapter le wizardMode selon le type d'utilisateur
      const wizardMode = userType === 'B2C' ? 'b2c_simple' : userType === 'B2G' ? 'b2g_public' : 'b2b_professional';

      const projectWithMode = {
        ...project,
        wizardMode,
      };

      const result = await EntrepriseService.findMatchingEntreprises({
        project: projectWithMode,
        rayonKm: 50,
        limiteResultats: userType === 'B2C' ? 6 : 10,
        filtres: {
          rgeObligatoire: true,
          noteMinimale: userType === 'B2C' ? 60 : 70,
        },
      });

      if (result.success) {
        // Transformer les entreprises en recommandations pour l'affichage
        const recommandations: RecommandationEntreprise[] = result.entreprises.map(e => ({
          entreprise: e,
          score: e.scoreTORP || {
            scoreGlobal: 75,
            criteres: [],
            recommandation: 'recommande' as const,
            confiance: 'moyen' as const,
            dateCalcul: new Date().toISOString(),
          },
          lots: project.selectedLots?.map(l => l.type) || [],
          pointsForts: ['Entreprise qualifiée', 'Assurances à jour'],
          pointsAttention: [],
          disponibilite: 'A confirmer',
        }));

        setConsultationState(prev => ({
          ...prev,
          status: 'en_consultation',
          currentStep: 2,
          entreprises: recommandations,
        }));

        toast({
          title: userType === 'B2C' ? 'Artisans trouvés' : 'Entreprises identifiées',
          description: `${result.entreprises.length} entreprise(s) qualifiée(s)`,
        });
      } else {
        toast({
          title: 'Recherche terminée',
          description: 'Aucune entreprise correspondant aux critères',
        });
      }
    } catch (err) {
      console.error('Erreur recherche entreprises:', err);
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de rechercher des entreprises',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [project, userType, toast]);

  // Calculer la progression globale
  const getProgress = () => {
    const stepValues: Record<ConsultationState['status'], number> = {
      draft: 0,
      dce_ready: 20,
      en_consultation: 40,
      offres_recues: 60,
      selection: 70,
      contractualise: 85,
      formalites: 95,
      pret: 100,
    };
    return stepValues[consultationState.status] || 0;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Projet non trouvé'}</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/phase0/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux projets
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to={`/phase0/project/${project.id}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au projet
            </Link>
          </Button>
          <Badge variant="outline">{config.label}</Badge>
        </div>

        {/* En-tête avec progression */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary" className="mb-2">Phase 1</Badge>
                <CardTitle className="text-2xl">
                  {userType === 'B2C'
                    ? 'Consultation des artisans'
                    : userType === 'B2G'
                      ? 'Consultation des entreprises'
                      : 'Consultation & Sélection'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {project.workProject?.general?.title || 'Projet sans titre'}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Progression</div>
                <div className="text-2xl font-bold text-primary">{getProgress()}%</div>
              </div>
            </div>
            <Progress value={getProgress()} className="mt-4" />
          </CardHeader>
        </Card>

        {/* Étapes de la consultation */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === consultationState.currentStep;
            const isCompleted = index < consultationState.currentStep;

            return (
              <Card
                key={step.id}
                className={`cursor-pointer transition-all ${
                  isActive ? 'border-primary bg-primary/5' :
                  isCompleted ? 'border-green-500/50 bg-green-50' :
                  'opacity-60'
                }`}
                onClick={() => setActiveTab(step.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${
                    isActive ? 'bg-primary text-white' :
                    isCompleted ? 'bg-green-500 text-white' :
                    'bg-muted'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-xs font-medium">{step.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Contenu principal */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="dce">{config.dceLabel}</TabsTrigger>
            <TabsTrigger value="entreprises">{config.entrepriseLabel}</TabsTrigger>
            <TabsTrigger value="offres">{config.offreLabel}</TabsTrigger>
            <TabsTrigger value="contrat">{config.contractLabel}</TabsTrigger>
          </TabsList>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Documents</div>
                      <div className="text-xl font-bold">
                        {consultationState.dce ? '4' : '0'} / 4
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {userType === 'B2C' ? 'Artisans' : 'Entreprises'}
                      </div>
                      <div className="text-xl font-bold">
                        {consultationState.entreprises.length}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                      <ClipboardList className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {userType === 'B2C' ? 'Devis reçus' : 'Offres'}
                      </div>
                      <div className="text-xl font-bold">
                        {consultationState.offres.length}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Euro className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Budget estimé</div>
                      <div className="text-xl font-bold">
                        {(project.workProject?.budget?.totalEnvelope?.min || 0).toLocaleString('fr-FR')} €
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions rapides selon l'étape et le profil */}
            <Card>
              <CardHeader>
                <CardTitle>Prochaine étape</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mode B2B : Réponse à appel d'offres */}
                {userType === 'B2B' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Préparez votre offre</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Rédigez votre proposition technique et financière pour ce projet
                        </p>
                      </div>
                      <Button onClick={() => setActiveTab('offres')}>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Rédiger mon offre
                      </Button>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <h3 className="font-medium text-muted-foreground">Besoin de sous-traitance ?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Recherchez des partenaires pour certains lots
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setActiveTab('entreprises')}>
                        <Building2 className="w-4 h-4 mr-2" />
                        Sous-traitance
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mode B2C/B2G : Consultation */}
                {userType !== 'B2B' && consultationState.status === 'draft' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        {userType === 'B2C'
                          ? 'Préparez votre dossier de consultation'
                          : 'Constituez votre DCE'
                        }
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {userType === 'B2C'
                          ? 'Nous allons préparer les documents pour consulter les artisans'
                          : 'Générez le Règlement de Consultation, CCTP, DPGF et Acte d\'Engagement'
                        }
                      </p>
                    </div>
                    <Button onClick={handleGenerateDCE} disabled={isProcessing}>
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      {userType === 'B2C' ? 'Préparer' : 'Générer DCE'}
                    </Button>
                  </div>
                )}

                {userType !== 'B2B' && consultationState.status === 'dce_ready' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">
                        {userType === 'B2C'
                          ? 'Trouvez des artisans qualifiés'
                          : 'Lancez la consultation'
                        }
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {userType === 'B2C'
                          ? 'Artisans RGE et Qualibat vérifiés dans votre secteur'
                          : 'Identifiez et qualifiez les entreprises adaptées à votre projet'
                        }
                      </p>
                    </div>
                    <Button onClick={handleSearchEntreprises} disabled={isProcessing}>
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4 mr-2" />
                      )}
                      {userType === 'B2C' ? 'Trouver des artisans' : 'Rechercher'}
                    </Button>
                  </div>
                )}

                {userType !== 'B2B' && consultationState.status === 'en_consultation' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Consultation en cours</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {consultationState.entreprises.length} entreprise(s) consultée(s) - En attente des offres
                      </p>
                    </div>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      En attente
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lots du projet */}
            <Card>
              <CardHeader>
                <CardTitle>Lots de travaux</CardTitle>
                <CardDescription>
                  {project.selectedLots?.length || 0} lot(s) à consulter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.selectedLots?.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{lot.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {lot.estimatedBudget?.min?.toLocaleString('fr-FR')} - {lot.estimatedBudget?.max?.toLocaleString('fr-FR')} €
                        </div>
                      </div>
                      <Badge variant="outline">
                        {consultationState.entreprises.filter(e => e.lots?.includes(lot.type)).length} candidat(s)
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet DCE */}
          <TabsContent value="dce" className="space-y-6">
            {!consultationState.dce ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {userType === 'B2C' ? 'Dossier de consultation' : 'Dossier de Consultation des Entreprises'}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {userType === 'B2C'
                      ? 'Préparez automatiquement les documents pour consulter les artisans'
                      : 'Générez le DCE complet : Règlement de Consultation, CCTP, DPGF, Acte d\'Engagement'
                    }
                  </p>
                  <Button onClick={handleGenerateDCE} disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Générer le {userType === 'B2C' ? 'dossier' : 'DCE'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Documents du DCE</CardTitle>
                    <CardDescription>
                      Vos documents de consultation sont prêts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* RC */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {userType === 'B2C' ? 'Cahier des charges' : 'Règlement de Consultation'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Conditions de la consultation
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Généré</Badge>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* CCTP */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-green-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {userType === 'B2C' ? 'Description des travaux' : 'CCTP'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Cahier des clauses techniques particulières
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Généré</Badge>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* DPGF */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-orange-100 flex items-center justify-center">
                          <Euro className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {userType === 'B2C' ? 'Grille de prix' : 'DPGF'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Décomposition du prix global forfaitaire
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Généré</Badge>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* AE */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center">
                          <Scale className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {userType === 'B2C' ? 'Modèle de contrat' : 'Acte d\'Engagement'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Document contractuel type
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Généré</Badge>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSearchEntreprises} disabled={isProcessing}>
                    Passer à la recherche d'entreprises
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Onglet Entreprises */}
          <TabsContent value="entreprises" className="space-y-6">
            {consultationState.entreprises.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {userType === 'B2C' ? 'Trouvez des artisans qualifiés' : 'Recherchez des entreprises'}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {userType === 'B2C'
                      ? 'Nous identifions les artisans RGE et Qualibat adaptés à votre projet'
                      : 'Sourcing et qualification des entreprises selon vos critères'
                    }
                  </p>
                  <Button
                    onClick={handleSearchEntreprises}
                    disabled={isProcessing || !consultationState.dce}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Lancer la recherche
                  </Button>
                  {!consultationState.dce && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Générez d'abord le DCE pour pouvoir consulter des entreprises
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {consultationState.entreprises.length} {userType === 'B2C' ? 'artisan(s)' : 'entreprise(s)'} recommandé(s)
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Triés par score TORP et pertinence
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filtrer
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {consultationState.entreprises.map((recommandation) => (
                    <Card key={recommandation.entreprise.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{recommandation.entreprise.identite.raisonSociale}</h3>
                            <p className="text-sm text-muted-foreground">
                              {recommandation.entreprise.identite.adresse?.ville}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
                            <Star className="w-4 h-4 text-primary fill-primary" />
                            <span className="font-bold text-primary">{recommandation.score.global}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {recommandation.entreprise.qualifications?.rge?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Award className="w-3 h-3 mr-1" />
                              RGE
                            </Badge>
                          )}
                          {recommandation.entreprise.qualifications?.qualibat?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="w-3 h-3 mr-1" />
                              Qualibat
                            </Badge>
                          )}
                          {recommandation.entreprise.assurances?.decennale?.valide && (
                            <Badge variant="outline" className="text-xs">
                              Décennale ✓
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground mb-3">
                          {recommandation.pointsForts.slice(0, 2).map((point, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {point}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Lots: </span>
                            {recommandation.lots?.slice(0, 2).join(', ')}
                          </div>
                          <Button size="sm">
                            <Send className="w-3 h-3 mr-1" />
                            Consulter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Onglet Offres */}
          <TabsContent value="offres" className="space-y-6">
            {/* Mode B2B : Rédaction de l'offre par l'entreprise */}
            {userType === 'B2B' ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Mon offre pour ce projet</CardTitle>
                    <CardDescription>
                      Rédigez votre proposition technique et financière
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Progression de l'offre */}
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Avancement de l'offre</div>
                          <div className="text-sm text-muted-foreground">2 étapes sur 4 complétées</div>
                        </div>
                      </div>
                      <Progress value={50} className="w-32" />
                    </div>

                    {/* Étape 1: Offre technique */}
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">
                            1
                          </div>
                          <div>
                            <div className="font-medium">Mémoire technique</div>
                            <div className="text-sm text-muted-foreground">Présentation de votre entreprise et méthodologie</div>
                          </div>
                        </div>
                        <Badge variant="default">Complété</Badge>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Présentation de l'entreprise</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Références similaires</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Méthodologie d'intervention</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Planning prévisionnel</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="mt-4">
                          <Eye className="w-4 h-4 mr-2" />
                          Modifier
                        </Button>
                      </div>
                    </div>

                    {/* Étape 2: Offre financière */}
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">
                            2
                          </div>
                          <div>
                            <div className="font-medium">Offre financière (DPGF)</div>
                            <div className="text-sm text-muted-foreground">Remplissez le bordereau de prix</div>
                          </div>
                        </div>
                        <Badge variant="default">Complété</Badge>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {(project?.workProject?.budget?.totalEnvelope?.min || 45000).toLocaleString('fr-FR')} € HT
                            </div>
                            <div className="text-sm text-muted-foreground">Montant total de votre offre</div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Euro className="w-4 h-4 mr-2" />
                            Modifier les prix
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Étape 3: Documents administratifs */}
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                            3
                          </div>
                          <div>
                            <div className="font-medium">Documents administratifs</div>
                            <div className="text-sm text-muted-foreground">Pièces justificatives obligatoires</div>
                          </div>
                        </div>
                        <Badge variant="secondary">En cours</Badge>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Kbis (moins de 3 mois)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>Attestation décennale</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <span>Attestation URSSAF</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <span>Certificat RGE</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="mt-4">
                          <Download className="w-4 h-4 mr-2" />
                          Téléverser documents
                        </Button>
                      </div>
                    </div>

                    {/* Étape 4: Signature et envoi */}
                    <div className="border rounded-lg border-dashed">
                      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm">
                            4
                          </div>
                          <div>
                            <div className="font-medium">Signature et envoi</div>
                            <div className="text-sm text-muted-foreground">Signez et soumettez votre offre</div>
                          </div>
                        </div>
                        <Badge variant="outline">À faire</Badge>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                          Complétez les étapes précédentes pour pouvoir soumettre votre offre
                        </p>
                        <Button disabled>
                          <Send className="w-4 h-4 mr-2" />
                          Soumettre mon offre
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Informations sur le projet */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Rappel du projet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Maître d'ouvrage</div>
                        <div className="font-medium">{project?.workProject?.owner?.firstName} {project?.workProject?.owner?.lastName}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lieu du chantier</div>
                        <div className="font-medium">{project?.workProject?.property?.address?.city || 'Non défini'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Date limite réponse</div>
                        <div className="font-medium text-orange-600">15 janvier 2025</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lots concernés</div>
                        <div className="font-medium">{project?.selectedLots?.length || 0} lot(s)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Mode B2C/B2G : Analyse des offres reçues */
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <ClipboardList className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {userType === 'B2C' ? 'Comparez les devis' : 'Analysez les offres'}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {consultationState.entreprises.length > 0
                      ? `${consultationState.entreprises.length} entreprise(s) consultée(s) - En attente des réponses`
                      : 'Lancez d\'abord la consultation pour recevoir des offres'
                    }
                  </p>
                  {consultationState.offres.length === 0 && (
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      En attente des offres
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Contrat */}
          <TabsContent value="contrat" className="space-y-6">
            <Card className="border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Scale className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {userType === 'B2C' ? 'Signez votre contrat' : config.contractLabel}
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {userType === 'B2C'
                    ? 'Après avoir choisi votre artisan, signez le contrat en toute sécurité'
                    : userType === 'B2G'
                      ? 'Attribution et notification du marché public'
                      : 'Génération et signature des marchés de travaux'
                  }
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default Phase1Consultation;
