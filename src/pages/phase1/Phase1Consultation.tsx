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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layout';
import {
  ArrowLeft, FileText, Building2, ClipboardList, Scale, FileCheck,
  Loader2, AlertTriangle, CheckCircle2, Clock, Users, Euro,
  Search, Star, Shield, Award, Send, Eye, Download, Filter, Plus, Trash2, Save, Calendar,
  HardHat, ArrowRight, Sparkles, Lock, FileSignature, ScrollText, BookOpen, Stamp
} from 'lucide-react';
import { Phase0ProjectService, Phase0Project } from '@/services/phase0';
import { DCEService } from '@/services/phase1/dce.service';
import { EntrepriseService } from '@/services/phase1/entreprise.service';
import { OffreService } from '@/services/phase1/offre.service';
import { ContratService } from '@/services/phase1/contrat.service';
import { FormalitesService } from '@/services/phase1/formalites.service';
import { UrbanismeService } from '@/services/phase1/urbanisme.service';
import type { AnalyseUrbanistique } from '@/services/phase1/urbanisme.service';
import { B2BOffreService } from '@/services/phase1/b2b-offre.service';
import type { DCEDocument, DCEStatus } from '@/types/phase1/dce.types';
import type { Entreprise, RecommandationEntreprise } from '@/types/phase1/entreprise.types';
import type { Offre, TableauComparatif } from '@/types/phase1/offre.types';
import type { Contrat } from '@/types/phase1/contrat.types';
import type { ChecklistFormalites, AlerteFormalite, DossierFormalites } from '@/types/phase1/formalites.types';
import { useApp, UserType } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { DCEDocumentViewer } from '@/components/phase1/DCEDocumentViewer';

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

// Interface pour le formulaire d'offre B2B
interface B2BOfferFormState {
  // Mémoire technique
  memoireTechnique: {
    presentationEntreprise: string;
    moyensHumains: string;
    moyensMateriels: string;
    methodologie: string;
    referencesProjet: string;
    engagementsQualite: string;
  };
  // Offre financière - postes du DPGF
  dpgfPostes: {
    id: string;
    designation: string;
    unite: string;
    quantite: number;
    prixUnitaireHT: number;
  }[];
  // Planning
  planning: {
    dateDebutProposee: string;
    dureeJours: number;
    commentairePlanning: string;
  };
  // Conditions
  conditions: {
    dureeValiditeOffre: number; // jours
    delaiPaiement: number; // jours
    acompte: number; // %
  };
}

const initialB2BOfferForm: B2BOfferFormState = {
  memoireTechnique: {
    presentationEntreprise: '',
    moyensHumains: '',
    moyensMateriels: '',
    methodologie: '',
    referencesProjet: '',
    engagementsQualite: '',
  },
  dpgfPostes: [],
  planning: {
    dateDebutProposee: '',
    dureeJours: 30,
    commentairePlanning: '',
  },
  conditions: {
    dureeValiditeOffre: 90,
    delaiPaiement: 30,
    acompte: 30,
  },
};

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

  // State pour le visualiseur de documents DCE
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [docViewerType, setDocViewerType] = useState<'rc' | 'ae' | 'dpgf' | 'mt' | 'all'>('all');

  // State pour le formulaire d'offre B2B
  const [b2bOfferForm, setB2BOfferForm] = useState<B2BOfferFormState>(initialB2BOfferForm);
  const [offerSaveStatus, setOfferSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // State pour les contrats
  const [showContractExample, setShowContractExample] = useState<string | null>(null);
  const [selectedEntrepriseForContract, setSelectedEntrepriseForContract] = useState<string | null>(null);
  const [generatingContract, setGeneratingContract] = useState<string | null>(null);
  const [generatedContract, setGeneratedContract] = useState<Contrat | null>(null);
  const [signatureStep, setSignatureStep] = useState<'idle' | 'review' | 'signing' | 'signed'>('idle');

  // State pour les formalités
  const [formalitesDossier, setFormalitesDossier] = useState<DossierFormalites | null>(null);
  const [formalitesChecklist, setFormalitesChecklist] = useState<ChecklistFormalites | null>(null);
  const [loadingFormalites, setLoadingFormalites] = useState(false);

  // State pour l'analyse urbanistique
  const [analyseUrbanistique, setAnalyseUrbanistique] = useState<AnalyseUrbanistique | null>(null);
  const [loadingUrbanisme, setLoadingUrbanisme] = useState(false);
  const [showPrefilledDoc, setShowPrefilledDoc] = useState<string | null>(null);

  const config = PROFILE_CONFIG[userType];
  const steps = getConsultationSteps(userType);

  // Calculer le total HT de l'offre B2B
  const calculateTotalHT = useCallback(() => {
    return b2bOfferForm.dpgfPostes.reduce((sum, poste) => {
      return sum + (poste.quantite * poste.prixUnitaireHT);
    }, 0);
  }, [b2bOfferForm.dpgfPostes]);

  // Calculer la progression de l'offre B2B
  const calculateOfferProgress = useCallback(() => {
    let completed = 0;
    const total = 4;

    // 1. Mémoire technique rempli ?
    const mt = b2bOfferForm.memoireTechnique;
    if (mt.presentationEntreprise && mt.methodologie) completed++;

    // 2. DPGF avec prix ?
    if (b2bOfferForm.dpgfPostes.length > 0 && b2bOfferForm.dpgfPostes.some(p => p.prixUnitaireHT > 0)) completed++;

    // 3. Planning défini ?
    if (b2bOfferForm.planning.dateDebutProposee && b2bOfferForm.planning.dureeJours > 0) completed++;

    // 4. Documents admin (auto depuis profil) - toujours compté comme fait
    completed++;

    return Math.round((completed / total) * 100);
  }, [b2bOfferForm]);

  // Ajouter un poste au DPGF
  const addDPGFPoste = useCallback(() => {
    setB2BOfferForm(prev => ({
      ...prev,
      dpgfPostes: [
        ...prev.dpgfPostes,
        {
          id: crypto.randomUUID(),
          designation: '',
          unite: 'u',
          quantite: 1,
          prixUnitaireHT: 0,
        },
      ],
    }));
  }, []);

  // Supprimer un poste du DPGF
  const removeDPGFPoste = useCallback((id: string) => {
    setB2BOfferForm(prev => ({
      ...prev,
      dpgfPostes: prev.dpgfPostes.filter(p => p.id !== id),
    }));
  }, []);

  // Mettre à jour un poste du DPGF
  const updateDPGFPoste = useCallback((id: string, field: string, value: string | number) => {
    setB2BOfferForm(prev => ({
      ...prev,
      dpgfPostes: prev.dpgfPostes.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  }, []);

  // Mettre à jour le mémoire technique
  const updateMemoireTechnique = useCallback((field: string, value: string) => {
    setB2BOfferForm(prev => ({
      ...prev,
      memoireTechnique: { ...prev.memoireTechnique, [field]: value },
    }));
  }, []);

  // Mettre à jour le planning
  const updatePlanning = useCallback((field: string, value: string | number) => {
    setB2BOfferForm(prev => ({
      ...prev,
      planning: { ...prev.planning, [field]: value },
    }));
  }, []);

  // Sauvegarder l'offre B2B
  const handleSaveB2BOffer = useCallback(async () => {
    if (!project || !projectId || !user?.id) return;

    setOfferSaveStatus('saving');
    try {
      // Construire l'offre pour sauvegarde
      const totalHT = calculateTotalHT();
      const offerData = {
        memoireTechnique: b2bOfferForm.memoireTechnique,
        dpgf: {
          postes: b2bOfferForm.dpgfPostes,
          totalHT,
        },
        planning: b2bOfferForm.planning,
        conditions: b2bOfferForm.conditions,
        status: 'draft' as const,
      };

      // Sauvegarder via le service B2B (Supabase + localStorage fallback)
      const result = await B2BOffreService.saveOffer(user.id, projectId, offerData, false);

      if (result.success) {
        // Backup en localStorage aussi
        localStorage.setItem(`b2b_offer_${projectId}`, JSON.stringify({
          ...offerData,
          projectId,
          updatedAt: new Date().toISOString(),
        }));

        setOfferSaveStatus('saved');
        toast({
          title: 'Offre sauvegardée',
          description: 'Votre offre a été enregistrée',
        });
      } else {
        throw new Error(result.error);
      }

      // Reset status après 3s
      setTimeout(() => setOfferSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Erreur sauvegarde offre:', err);
      setOfferSaveStatus('error');
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder l\'offre',
        variant: 'destructive',
      });
    }
  }, [project, projectId, user?.id, b2bOfferForm, calculateTotalHT, toast]);

  // Charger l'offre B2B existante ou pré-remplir depuis le profil
  useEffect(() => {
    const loadB2BOffer = async () => {
      if (!projectId || userType !== 'B2B' || !user?.id) return;

      try {
        // Essayer de charger depuis Supabase d'abord, puis localStorage
        const savedOffer = await B2BOffreService.getOfferByProject(user.id, projectId);

        if (savedOffer) {
          setB2BOfferForm({
            memoireTechnique: savedOffer.memoireTechnique || initialB2BOfferForm.memoireTechnique,
            dpgfPostes: savedOffer.dpgf?.postes || [],
            planning: savedOffer.planning || initialB2BOfferForm.planning,
            conditions: savedOffer.conditions || initialB2BOfferForm.conditions,
          });
        } else {
          // Pas d'offre existante, pré-remplir depuis le profil entreprise
          const profileData = await B2BOffreService.prefillFromProfile(user.id);

          setB2BOfferForm(prev => ({
            ...prev,
            memoireTechnique: {
              presentationEntreprise: profileData.presentationEntreprise || user.company_description || '',
              moyensHumains: profileData.moyensHumains || user.company_human_resources || '',
              moyensMateriels: profileData.moyensMateriels || user.company_material_resources || '',
              methodologie: profileData.methodologie || user.company_methodology || '',
              referencesProjet: profileData.referencesProjet || '',
              engagementsQualite: profileData.engagementsQualite || user.company_quality_commitments || '',
            },
          }));

          // Initialiser les postes DPGF depuis les lots du projet
          if (project?.selectedLots) {
            const initialPostes = project.selectedLots.map(lot => ({
              id: crypto.randomUUID(),
              designation: lot.name,
              unite: 'ens',
              quantite: 1,
              prixUnitaireHT: 0,
            }));
            setB2BOfferForm(prev => ({
              ...prev,
              dpgfPostes: initialPostes,
            }));
          }
        }
      } catch (e) {
        console.error('Erreur chargement offre B2B:', e);

        // Fallback: pré-remplir depuis le contexte utilisateur
        if (user) {
          setB2BOfferForm(prev => ({
            ...prev,
            memoireTechnique: {
              presentationEntreprise: user.company_description || '',
              moyensHumains: user.company_human_resources || '',
              moyensMateriels: user.company_material_resources || '',
              methodologie: user.company_methodology || '',
              referencesProjet: '',
              engagementsQualite: user.company_quality_commitments || '',
            },
          }));
        }
      }
    };

    loadB2BOffer();
  }, [projectId, userType, user?.id, project]);

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
          <div className="flex items-center gap-2">
            <Badge variant="outline">{config.label}</Badge>
            {consultationState.currentStep >= 4 && (
              <Button asChild>
                <Link to={`/phase2/${project.id}`}>
                  <HardHat className="w-4 h-4 mr-2" />
                  Phase 2 : Chantier
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
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
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="dce">{config.dceLabel}</TabsTrigger>
            <TabsTrigger value="entreprises">{config.entrepriseLabel}</TabsTrigger>
            <TabsTrigger value="offres">{config.offreLabel}</TabsTrigger>
            <TabsTrigger value="contrat">{config.contractLabel}</TabsTrigger>
            <TabsTrigger value="formalites">Formalités</TabsTrigger>
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
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('rc'); setShowDocViewer(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('rc'); setShowDocViewer(true); }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* CCTP - Note: CCTP uses RC viewer for now as it contains similar info */}
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
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('rc'); setShowDocViewer(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('rc'); setShowDocViewer(true); }}>
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
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('dpgf'); setShowDocViewer(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('dpgf'); setShowDocViewer(true); }}>
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
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('ae'); setShowDocViewer(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDocViewerType('ae'); setShowDocViewer(true); }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Bouton voir tous les documents */}
                    <div className="pt-4 border-t">
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => { setDocViewerType('all'); setShowDocViewer(true); }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir tous les documents du DCE
                      </Button>
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
                {/* Header avec progression et sauvegarde */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Mon offre pour ce projet</h2>
                      <p className="text-sm text-muted-foreground">
                        Progression: {calculateOfferProgress()}%
                      </p>
                    </div>
                    <Progress value={calculateOfferProgress()} className="w-32" />
                  </div>
                  <Button
                    onClick={handleSaveB2BOffer}
                    disabled={offerSaveStatus === 'saving'}
                    variant={offerSaveStatus === 'saved' ? 'outline' : 'default'}
                  >
                    {offerSaveStatus === 'saving' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : offerSaveStatus === 'saved' ? (
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {offerSaveStatus === 'saved' ? 'Sauvegardé' : 'Sauvegarder'}
                  </Button>
                </div>

                {/* 1. Mémoire Technique */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
                      Mémoire technique
                    </CardTitle>
                    <CardDescription>
                      Présentez votre entreprise et votre méthodologie pour ce projet
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="presentationEntreprise">Présentation de l'entreprise</Label>
                      <Textarea
                        id="presentationEntreprise"
                        placeholder="Décrivez votre entreprise, son historique, ses compétences clés..."
                        value={b2bOfferForm.memoireTechnique.presentationEntreprise}
                        onChange={(e) => updateMemoireTechnique('presentationEntreprise', e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="moyensHumains">Moyens humains</Label>
                        <Textarea
                          id="moyensHumains"
                          placeholder="Équipe dédiée au projet, qualifications..."
                          value={b2bOfferForm.memoireTechnique.moyensHumains}
                          onChange={(e) => updateMemoireTechnique('moyensHumains', e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="moyensMateriels">Moyens matériels</Label>
                        <Textarea
                          id="moyensMateriels"
                          placeholder="Équipements, véhicules, outillage..."
                          value={b2bOfferForm.memoireTechnique.moyensMateriels}
                          onChange={(e) => updateMemoireTechnique('moyensMateriels', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="methodologie">Méthodologie d'intervention</Label>
                      <Textarea
                        id="methodologie"
                        placeholder="Décrivez votre approche technique, les phases d'intervention, les mesures de sécurité..."
                        value={b2bOfferForm.memoireTechnique.methodologie}
                        onChange={(e) => updateMemoireTechnique('methodologie', e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="referencesProjet">Références similaires</Label>
                        <Textarea
                          id="referencesProjet"
                          placeholder="Chantiers similaires réalisés, avec montants et dates..."
                          value={b2bOfferForm.memoireTechnique.referencesProjet}
                          onChange={(e) => updateMemoireTechnique('referencesProjet', e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="engagementsQualite">Engagements qualité</Label>
                        <Textarea
                          id="engagementsQualite"
                          placeholder="Certifications, garanties, SAV..."
                          value={b2bOfferForm.memoireTechnique.engagementsQualite}
                          onChange={(e) => updateMemoireTechnique('engagementsQualite', e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Offre Financière (DPGF) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                      Offre financière (DPGF)
                    </CardTitle>
                    <CardDescription>
                      Renseignez vos prix unitaires pour chaque poste
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Table DPGF */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-medium">Désignation</th>
                            <th className="text-center p-3 font-medium w-20">Unité</th>
                            <th className="text-center p-3 font-medium w-24">Quantité</th>
                            <th className="text-right p-3 font-medium w-32">Prix unit. HT</th>
                            <th className="text-right p-3 font-medium w-32">Total HT</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {b2bOfferForm.dpgfPostes.map((poste) => (
                            <tr key={poste.id} className="border-t">
                              <td className="p-2">
                                <Input
                                  value={poste.designation}
                                  onChange={(e) => updateDPGFPoste(poste.id, 'designation', e.target.value)}
                                  placeholder="Désignation du poste"
                                  className="h-9"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={poste.unite}
                                  onChange={(e) => updateDPGFPoste(poste.id, 'unite', e.target.value)}
                                  className="h-9 text-center"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={poste.quantite}
                                  onChange={(e) => updateDPGFPoste(poste.id, 'quantite', parseFloat(e.target.value) || 0)}
                                  className="h-9 text-center"
                                  min={0}
                                  step={0.01}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={poste.prixUnitaireHT || ''}
                                  onChange={(e) => updateDPGFPoste(poste.id, 'prixUnitaireHT', parseFloat(e.target.value) || 0)}
                                  className="h-9 text-right"
                                  placeholder="0,00"
                                  min={0}
                                  step={0.01}
                                />
                              </td>
                              <td className="p-2 text-right font-medium">
                                {(poste.quantite * poste.prixUnitaireHT).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              </td>
                              <td className="p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDPGFPoste(poste.id)}
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50">
                          <tr className="border-t-2">
                            <td colSpan={4} className="p-3 text-right font-semibold">
                              Total HT
                            </td>
                            <td className="p-3 text-right font-bold text-lg text-primary">
                              {calculateTotalHT().toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <Button variant="outline" onClick={addDPGFPoste} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter un poste
                    </Button>

                    {/* Conditions financières */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Validité de l'offre (jours)</Label>
                        <Input
                          type="number"
                          value={b2bOfferForm.conditions.dureeValiditeOffre}
                          onChange={(e) => setB2BOfferForm(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, dureeValiditeOffre: parseInt(e.target.value) || 90 }
                          }))}
                          min={30}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Acompte demandé (%)</Label>
                        <Input
                          type="number"
                          value={b2bOfferForm.conditions.acompte}
                          onChange={(e) => setB2BOfferForm(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, acompte: parseInt(e.target.value) || 0 }
                          }))}
                          min={0}
                          max={50}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Délai de paiement (jours)</Label>
                        <Input
                          type="number"
                          value={b2bOfferForm.conditions.delaiPaiement}
                          onChange={(e) => setB2BOfferForm(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, delaiPaiement: parseInt(e.target.value) || 30 }
                          }))}
                          min={0}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Planning */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">3</div>
                      Planning proposé
                    </CardTitle>
                    <CardDescription>
                      Définissez vos délais d'intervention
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateDebut">Date de début proposée</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="dateDebut"
                            type="date"
                            value={b2bOfferForm.planning.dateDebutProposee}
                            onChange={(e) => updatePlanning('dateDebutProposee', e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duree">Durée des travaux (jours)</Label>
                        <Input
                          id="duree"
                          type="number"
                          value={b2bOfferForm.planning.dureeJours}
                          onChange={(e) => updatePlanning('dureeJours', parseInt(e.target.value) || 0)}
                          min={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date de fin estimée</Label>
                        <Input
                          type="text"
                          value={
                            b2bOfferForm.planning.dateDebutProposee && b2bOfferForm.planning.dureeJours
                              ? new Date(
                                  new Date(b2bOfferForm.planning.dateDebutProposee).getTime() +
                                  b2bOfferForm.planning.dureeJours * 24 * 60 * 60 * 1000
                                ).toLocaleDateString('fr-FR')
                              : '-'
                          }
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="commentairePlanning">Commentaires sur le planning</Label>
                      <Textarea
                        id="commentairePlanning"
                        placeholder="Précisions sur les phases, contraintes particulières..."
                        value={b2bOfferForm.planning.commentairePlanning}
                        onChange={(e) => updatePlanning('commentairePlanning', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Documents administratifs - Auto depuis profil */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      Documents administratifs
                      <Badge variant="default" className="ml-2">Auto</Badge>
                    </CardTitle>
                    <CardDescription>
                      Récupérés automatiquement depuis votre profil entreprise
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <Shield className="w-5 h-5" />
                      <span>Les documents de votre profil seront joints automatiquement à votre offre</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Kbis</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Attestation décennale</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Attestation URSSAF</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>Certificat RGE</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 text-muted-foreground" asChild>
                      <Link to="/profile/documents">
                        <Users className="w-4 h-4 mr-2" />
                        Gérer mes documents (profil)
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Bouton de soumission */}
                <Card className="border-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Prêt à soumettre ?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Montant total: <span className="font-bold text-primary">{calculateTotalHT().toLocaleString('fr-FR')} € HT</span>
                        </p>
                      </div>
                      <Button
                        size="lg"
                        disabled={calculateOfferProgress() < 75}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Soumettre mon offre
                      </Button>
                    </div>
                    {calculateOfferProgress() < 75 && (
                      <p className="text-sm text-orange-600 mt-2">
                        Complétez les sections requises avant de soumettre
                      </p>
                    )}
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
            {/* En-tête avec explication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  {userType === 'B2C' ? 'Documents contractuels' : config.contractLabel}
                </CardTitle>
                <CardDescription>
                  {userType === 'B2C'
                    ? 'Découvrez les documents qui formaliseront votre accord avec l\'artisan sélectionné'
                    : userType === 'B2G'
                      ? 'Documents officiels pour l\'attribution du marché public'
                      : 'Documents contractuels pour sécuriser vos travaux'
                  }
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Liste des documents contractuels */}
            <div className="grid gap-4">
              {/* Contrat de travaux principal */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileSignature className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {userType === 'B2G' ? 'Acte d\'engagement' : 'Contrat de travaux'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {userType === 'B2C'
                            ? 'Document principal définissant les travaux, le prix, les délais et les garanties'
                            : userType === 'B2G'
                              ? 'Document officiel d\'engagement de l\'entreprise attributaire'
                              : 'Marché de travaux avec toutes les conditions contractuelles'
                          }
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">Obligatoire</Badge>
                          {userType === 'B2C' && (
                            <Badge variant="outline" className="text-xs">Délai rétractation 14j</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContractExample('contrat_travaux')}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Voir exemple
                      </Button>
                      <Button
                        size="sm"
                        disabled={consultationState.entreprises.length === 0 || generatingContract === 'contrat_travaux'}
                        onClick={() => {
                          if (consultationState.entreprises.length > 0) {
                            setGeneratingContract('contrat_travaux');
                            toast({
                              title: 'Sélectionnez une entreprise',
                              description: 'Pour générer le contrat, veuillez d\'abord sélectionner une entreprise dans l\'onglet "Trouver des artisans".',
                            });
                            setGeneratingContract(null);
                          }
                        }}
                      >
                        {consultationState.entreprises.length === 0 ? (
                          <Lock className="w-4 h-4 mr-2" />
                        ) : generatingContract === 'contrat_travaux' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <FileSignature className="w-4 h-4 mr-2" />
                        )}
                        Générer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conditions générales */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <ScrollText className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {userType === 'B2G' ? 'CCAP - Cahier des clauses administratives' : 'Conditions générales'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {userType === 'B2C'
                            ? 'Clauses standards régissant l\'exécution des travaux et les responsabilités'
                            : userType === 'B2G'
                              ? 'Clauses administratives particulières du marché'
                              : 'Conditions générales applicables aux marchés privés'
                          }
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">Annexe au contrat</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContractExample('conditions_generales')}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Voir exemple
                      </Button>
                      <Button
                        size="sm"
                        disabled={consultationState.entreprises.length === 0}
                      >
                        {consultationState.entreprises.length === 0 ? (
                          <Lock className="w-4 h-4 mr-2" />
                        ) : (
                          <FileSignature className="w-4 h-4 mr-2" />
                        )}
                        Générer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attestation d'assurance */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">Attestation d'assurance décennale</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Document obligatoire prouvant que l'entreprise dispose d'une assurance décennale valide
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">Obligatoire</Badge>
                          <Badge variant="outline" className="text-xs">Validité à vérifier</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContractExample('attestation_assurance')}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Voir exemple
                      </Button>
                      <Button
                        size="sm"
                        disabled={consultationState.entreprises.length === 0}
                      >
                        {consultationState.entreprises.length === 0 ? (
                          <Lock className="w-4 h-4 mr-2" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Récupérer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PV de réception */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Stamp className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">Procès-verbal de réception</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Document officialisant la fin des travaux et le début des garanties légales
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">À établir en fin de chantier</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContractExample('pv_reception')}
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        Voir exemple
                      </Button>
                      <Button
                        size="sm"
                        disabled={consultationState.status !== 'contractualise'}
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Générer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents B2G spécifiques */}
              {userType === 'B2G' && (
                <>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-6 h-6 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">Lettre de notification</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Notification officielle de l'attribution du marché à l'entreprise retenue
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">Marché public</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowContractExample('notification')}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Voir exemple
                          </Button>
                          <Button size="sm" disabled={consultationState.entreprises.length === 0}>
                            {consultationState.entreprises.length === 0 ? (
                              <Lock className="w-4 h-4 mr-2" />
                            ) : (
                              <FileSignature className="w-4 h-4 mr-2" />
                            )}
                            Générer
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <FileCheck className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">Ordre de service</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Document donnant l'ordre de démarrer les travaux
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">Démarrage travaux</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowContractExample('ordre_service')}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Voir exemple
                          </Button>
                          <Button size="sm" disabled={consultationState.status !== 'contractualise'}>
                            <Lock className="w-4 h-4 mr-2" />
                            Générer
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Message si aucune entreprise consultée */}
            {consultationState.entreprises.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Entreprise requise</span>
                  <br />
                  Pour générer les documents contractuels, vous devez d'abord consulter des entreprises et recevoir des offres.
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-1"
                    onClick={() => setActiveTab('entreprises')}
                  >
                    Rechercher des entreprises
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Section génération et signature de contrat */}
            {consultationState.entreprises.length > 0 && (
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-primary" />
                    Générer et signer le contrat
                  </CardTitle>
                  <CardDescription>
                    Sélectionnez l'entreprise retenue pour générer le contrat de travaux
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Sélection entreprise */}
                  {!generatedContract && (
                    <div className="space-y-4">
                      <Label>Entreprise sélectionnée</Label>
                      <div className="grid gap-2">
                        {consultationState.entreprises.map((entreprise) => (
                          <div
                            key={entreprise.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedEntrepriseForContract === entreprise.id
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedEntrepriseForContract(entreprise.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  selectedEntrepriseForContract === entreprise.id
                                    ? 'border-primary bg-primary'
                                    : 'border-muted-foreground'
                                }`}>
                                  {selectedEntrepriseForContract === entreprise.id && (
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{entreprise.nom}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {entreprise.specialites?.join(', ') || 'Artisan qualifié'}
                                  </p>
                                </div>
                              </div>
                              {entreprise.score && (
                                <Badge variant="secondary">
                                  <Star className="w-3 h-3 mr-1" />
                                  {entreprise.score}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        className="w-full"
                        disabled={!selectedEntrepriseForContract || generatingContract !== null}
                        onClick={async () => {
                          if (!selectedEntrepriseForContract || !project) return;
                          setGeneratingContract('generating');
                          try {
                            // Simuler la génération du contrat
                            await new Promise(resolve => setTimeout(resolve, 1500));

                            const mockContrat: Contrat = {
                              id: crypto.randomUUID(),
                              projectId: project.id,
                              consultationId: consultationState.dce?.id || '',
                              offreId: '',
                              type: 'marche_prive_b2c',
                              mode: project.wizardMode || 'b2c_simple',
                              parties: {
                                maitreOuvrage: {
                                  type: 'particulier',
                                  nom: project.ownerProfile?.identity?.type === 'B2C'
                                    ? `${(project.ownerProfile.identity as any).firstName || ''} ${(project.ownerProfile.identity as any).lastName || ''}`.trim()
                                    : 'Maître d\'ouvrage',
                                  adresse: project.ownerProfile?.contact?.address || { street: '', postalCode: '', city: '', country: 'France' },
                                  email: project.ownerProfile?.contact?.email || '',
                                  telephone: project.ownerProfile?.contact?.phone || '',
                                },
                                entreprise: {
                                  raisonSociale: consultationState.entreprises.find(e => e.id === selectedEntrepriseForContract)?.nom || '',
                                  formeJuridique: 'SARL',
                                  siret: '123 456 789 00012',
                                  adresse: { street: '', postalCode: '', city: '', country: 'France' },
                                  representant: { nom: '', qualite: 'Gérant' },
                                  email: '',
                                  telephone: '',
                                  assuranceDecennale: { compagnie: '', numeroPolice: '', validiteJusquau: '', montantGaranti: 0 },
                                  assuranceRC: { compagnie: '', numeroPolice: '', validiteJusquau: '', montantGaranti: 0 },
                                  qualifications: [],
                                },
                              },
                              objet: {
                                titre: project.workProject?.general?.title || 'Travaux de rénovation',
                                description: project.workProject?.general?.description || '',
                                adresseChantier: project.property?.address || { street: '', postalCode: '', city: '', country: 'France' },
                                natureTravaux: project.workProject?.scope?.workType || 'renovation',
                                lots: [],
                              },
                              conditionsFinancieres: {
                                prix: { type: 'forfaitaire', montantHT: 25000, tauxTVA: 10, montantTVA: 2500, montantTTC: 27500 },
                                revision: { applicable: false },
                                paiement: { echeancier: [], delaiPaiement: 30, baseDelai: 'situation_validee' },
                                retenueGarantie: { applicable: true, pourcentage: 5, duree: 12, liberation: { automatique: true, conditions: [] }, substitution: { cautionBancaire: true } },
                                penalites: { retard: { montantParJour: '1/1000', debutDecompte: '', causesSuspension: [] } },
                              },
                              delais: {
                                preparation: { duree: 2, unite: 'semaines' },
                                execution: { duree: 60, unite: 'jours_calendaires', debutType: 'ordre_service' },
                                reception: { delaiDemande: 15, delaiReponse: 20, delaiLeveeReserves: 30 },
                              },
                              garanties: {
                                legales: {
                                  parfaitAchevement: { duree: 1, couverture: '' },
                                  biennale: { duree: 2, couverture: '', elementsCouverts: [] },
                                  decennale: { duree: 10, couverture: '' },
                                },
                                assurancesObligatoires: { rcDecennale: true, rcProfessionnelle: true, montantMinimum: 0 },
                                assurancesFacultatives: { dommageOuvrage: { souscrit: false }, trc: { souscrit: false } },
                              },
                              clauses: { obligatoires: [], particulieres: [] },
                              annexes: [],
                              signature: {
                                entreprise: { signee: false, typeSignature: 'electronique_simple', cachet: true },
                                maitreOuvrage: { signee: false, typeSignature: 'electronique_simple' },
                              },
                              statut: 'brouillon',
                              metadata: { version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'system', exportFormats: ['pdf'] },
                            };

                            setGeneratedContract(mockContrat);
                            setSignatureStep('review');
                            toast({
                              title: 'Contrat généré',
                              description: 'Vérifiez les informations avant de signer',
                            });
                          } catch (err) {
                            console.error('Error generating contract:', err);
                            toast({
                              title: 'Erreur',
                              description: 'Impossible de générer le contrat',
                              variant: 'destructive',
                            });
                          } finally {
                            setGeneratingContract(null);
                          }
                        }}
                      >
                        {generatingContract === 'generating' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <FileSignature className="w-4 h-4 mr-2" />
                        )}
                        Générer le contrat
                      </Button>
                    </div>
                  )}

                  {/* Workflow de signature */}
                  {generatedContract && (
                    <div className="space-y-4">
                      {/* Étapes de signature */}
                      <div className="flex items-center justify-between mb-6">
                        <div className={`flex items-center gap-2 ${signatureStep === 'review' ? 'text-primary' : signatureStep === 'signing' || signatureStep === 'signed' ? 'text-green-600' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signatureStep === 'review' ? 'bg-primary text-white' : signatureStep === 'signing' || signatureStep === 'signed' ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                            {signatureStep === 'signing' || signatureStep === 'signed' ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                          </div>
                          <span className="text-sm font-medium">Vérification</span>
                        </div>
                        <div className="flex-1 h-px bg-muted mx-2" />
                        <div className={`flex items-center gap-2 ${signatureStep === 'signing' ? 'text-primary' : signatureStep === 'signed' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signatureStep === 'signing' ? 'bg-primary text-white' : signatureStep === 'signed' ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                            {signatureStep === 'signed' ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                          </div>
                          <span className="text-sm font-medium">Signature</span>
                        </div>
                        <div className="flex-1 h-px bg-muted mx-2" />
                        <div className={`flex items-center gap-2 ${signatureStep === 'signed' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signatureStep === 'signed' ? 'bg-green-600 text-white' : 'bg-muted'}`}>
                            {signatureStep === 'signed' ? <CheckCircle2 className="w-4 h-4" /> : '3'}
                          </div>
                          <span className="text-sm font-medium">Validé</span>
                        </div>
                      </div>

                      {/* Contenu selon l'étape */}
                      {signatureStep === 'review' && (
                        <div className="space-y-4">
                          <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertDescription>
                              <span className="font-medium">Vérifiez les informations du contrat</span>
                              <br />
                              Montant TTC: {generatedContract.conditionsFinancieres.prix.montantTTC.toLocaleString('fr-FR')} €
                              <br />
                              Durée: {generatedContract.delais.execution.duree} jours
                            </AlertDescription>
                          </Alert>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { setGeneratedContract(null); setSignatureStep('idle'); }}>
                              Modifier
                            </Button>
                            <Button onClick={() => setSignatureStep('signing')}>
                              Valider et signer
                            </Button>
                          </div>
                        </div>
                      )}

                      {signatureStep === 'signing' && (
                        <div className="space-y-4">
                          <div className="p-6 border-2 border-dashed rounded-lg text-center">
                            <FileSignature className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="font-medium mb-2">Signature électronique</p>
                            <p className="text-sm text-muted-foreground mb-4">
                              En cliquant sur "Signer", vous acceptez les termes du contrat
                            </p>
                            <div className="flex justify-center gap-2">
                              <Button variant="outline" onClick={() => setSignatureStep('review')}>
                                Retour
                              </Button>
                              <Button
                                onClick={async () => {
                                  setGeneratingContract('signing');
                                  await new Promise(resolve => setTimeout(resolve, 1500));
                                  setGeneratedContract({
                                    ...generatedContract,
                                    signature: {
                                      ...generatedContract.signature,
                                      maitreOuvrage: {
                                        ...generatedContract.signature.maitreOuvrage,
                                        signee: true,
                                        dateSignature: new Date().toISOString(),
                                      },
                                    },
                                    statut: 'signe_mo',
                                  });
                                  setSignatureStep('signed');
                                  setGeneratingContract(null);
                                  toast({
                                    title: 'Contrat signé !',
                                    description: 'Le contrat a été signé avec succès. L\'entreprise sera notifiée.',
                                  });
                                }}
                                disabled={generatingContract === 'signing'}
                              >
                                {generatingContract === 'signing' ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <FileSignature className="w-4 h-4 mr-2" />
                                )}
                                Signer le contrat
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {signatureStep === 'signed' && (
                        <div className="space-y-4">
                          <Alert className="border-green-200 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                              <span className="font-medium">Contrat signé avec succès !</span>
                              <br />
                              Signé le {new Date(generatedContract.signature.maitreOuvrage.dateSignature || '').toLocaleDateString('fr-FR')}
                              <br />
                              En attente de la signature de l'entreprise
                            </AlertDescription>
                          </Alert>
                          <div className="flex gap-2">
                            <Button variant="outline">
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger PDF
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('formalites')}>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Voir les formalités
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Modal exemple de document */}
            {showContractExample && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Exemple de document
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowContractExample(null)}
                    >
                      Fermer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-6 border shadow-sm max-h-96 overflow-y-auto">
                    {showContractExample === 'contrat_travaux' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">CONTRAT DE TRAVAUX</h2>
                          <p className="text-muted-foreground">Entre les soussignés</p>
                        </div>
                        <div>
                          <h3 className="font-semibold">ARTICLE 1 - PARTIES</h3>
                          <p className="text-muted-foreground mt-1">
                            <strong>Le Maître d'Ouvrage :</strong> [Nom du client], demeurant [adresse]<br />
                            <strong>L'Entreprise :</strong> [Raison sociale], SIRET [numéro], représentée par [nom]
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">ARTICLE 2 - OBJET</h3>
                          <p className="text-muted-foreground mt-1">
                            Le présent contrat a pour objet la réalisation des travaux de [description]
                            situés à [adresse du chantier], conformément au descriptif technique annexé.
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">ARTICLE 3 - PRIX</h3>
                          <p className="text-muted-foreground mt-1">
                            Le prix forfaitaire des travaux est fixé à : XX XXX,XX € TTC<br />
                            Ce prix comprend la fourniture des matériaux et la main d'œuvre.
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">ARTICLE 4 - DÉLAIS</h3>
                          <p className="text-muted-foreground mt-1">
                            Durée des travaux : XX jours ouvrés<br />
                            Date de début prévisionnelle : [date]
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">ARTICLE 5 - GARANTIES</h3>
                          <p className="text-muted-foreground mt-1">
                            L'entreprise est couverte par une assurance décennale n°[numéro]
                            auprès de [compagnie].
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Ceci est un exemple - Le document réel sera personnalisé avec vos informations
                        </div>
                      </div>
                    )}
                    {showContractExample === 'conditions_generales' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">CONDITIONS GÉNÉRALES</h2>
                          <p className="text-muted-foreground">Applicables aux marchés de travaux</p>
                        </div>
                        <div>
                          <h3 className="font-semibold">1. EXÉCUTION DES TRAVAUX</h3>
                          <p className="text-muted-foreground mt-1">
                            Les travaux seront exécutés conformément aux règles de l'art et
                            aux normes en vigueur (DTU, NF...).
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">2. MODIFICATIONS</h3>
                          <p className="text-muted-foreground mt-1">
                            Toute modification du projet devra faire l'objet d'un avenant signé par les deux parties.
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">3. RÉCEPTION</h3>
                          <p className="text-muted-foreground mt-1">
                            La réception des travaux sera prononcée contradictoirement.
                            Un procès-verbal sera établi.
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Ceci est un exemple - Le document réel sera personnalisé
                        </div>
                      </div>
                    )}
                    {showContractExample === 'attestation_assurance' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">ATTESTATION D'ASSURANCE</h2>
                          <p className="text-muted-foreground">Responsabilité Civile Décennale</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-muted-foreground">
                            <strong>Compagnie :</strong> [Nom de l'assureur]<br />
                            <strong>Numéro de police :</strong> XXXX-XXXX-XXXX<br />
                            <strong>Activités garanties :</strong> Tous corps d'état bâtiment<br />
                            <strong>Période de validité :</strong> Du 01/01/2024 au 31/12/2024<br />
                            <strong>Montant garanti :</strong> Illimité
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Ce document sera fourni par l'entreprise sélectionnée
                        </div>
                      </div>
                    )}
                    {showContractExample === 'pv_reception' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">PROCÈS-VERBAL DE RÉCEPTION</h2>
                          <p className="text-muted-foreground">Des travaux</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            <strong>Chantier :</strong> [adresse]<br />
                            <strong>Date de réception :</strong> [date]<br />
                            <strong>Présents :</strong> Le maître d'ouvrage et l'entreprise
                          </p>
                        </div>
                        <div>
                          <h3 className="font-semibold">RÉSERVES</h3>
                          <p className="text-muted-foreground mt-1">
                            ☐ Sans réserve<br />
                            ☐ Avec réserves (liste ci-dessous)
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Ce document sera généré à la fin des travaux
                        </div>
                      </div>
                    )}
                    {showContractExample === 'notification' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">NOTIFICATION D'ATTRIBUTION</h2>
                          <p className="text-muted-foreground">Marché public</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            La collectivité [nom] notifie par la présente l'attribution
                            du marché n°[référence] à l'entreprise [nom].<br /><br />
                            Montant du marché : XX XXX,XX € HT<br />
                            Délai d'exécution : XX jours
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Document officiel de marché public
                        </div>
                      </div>
                    )}
                    {showContractExample === 'ordre_service' && (
                      <div className="space-y-4 text-sm">
                        <div className="text-center border-b pb-4">
                          <h2 className="font-bold text-lg">ORDRE DE SERVICE</h2>
                          <p className="text-muted-foreground">N° 01 - Démarrage des travaux</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Le maître d'ouvrage ordonne à l'entreprise [nom] de commencer
                            l'exécution des travaux objets du marché n°[référence].<br /><br />
                            <strong>Date d'effet :</strong> [date]<br />
                            <strong>Délai d'exécution :</strong> XX jours à compter de cette date
                          </p>
                        </div>
                        <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          Document officiel de marché public
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Formalités - Analyse Intelligente */}
          <TabsContent value="formalites" className="space-y-6">
            {/* En-tête avec bouton d'analyse */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-primary" />
                      Formalités pré-démarrage
                    </CardTitle>
                    <CardDescription>
                      Analyse automatique des démarches administratives requises selon votre projet
                    </CardDescription>
                  </div>
                  {!analyseUrbanistique && project && (
                    <Button
                      onClick={async () => {
                        if (!project) return;
                        setLoadingUrbanisme(true);
                        try {
                          const analyse = await UrbanismeService.analyzeProject(project);
                          setAnalyseUrbanistique(analyse);

                          // Générer aussi le dossier formalités
                          const result = await FormalitesService.generateDossierFormalites({
                            project,
                            contrat: generatedContract || undefined,
                          });
                          if (result.success && result.dossier) {
                            setFormalitesDossier(result.dossier);
                            setFormalitesChecklist(result.checklist || null);
                          }

                          toast({
                            title: 'Analyse terminée',
                            description: `${analyse.autorisationsRequises.length} autorisation(s) détectée(s)`,
                          });
                        } catch (err) {
                          console.error('Error analyzing:', err);
                          toast({
                            title: 'Erreur',
                            description: 'Impossible d\'analyser le projet',
                            variant: 'destructive',
                          });
                        } finally {
                          setLoadingUrbanisme(false);
                        }
                      }}
                      disabled={loadingUrbanisme}
                    >
                      {loadingUrbanisme ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Analyser mon projet
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Résultat de l'analyse urbanistique */}
            {analyseUrbanistique && (
              <>
                {/* Contexte local */}
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Contexte urbanistique local
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Commune */}
                      <div className="p-3 bg-white rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Commune</p>
                        <p className="font-semibold">{analyseUrbanistique.commune.nom}</p>
                        <p className="text-sm text-muted-foreground">
                          {analyseUrbanistique.commune.departement} - {analyseUrbanistique.commune.region}
                        </p>
                        <p className="text-xs mt-1">
                          Document d'urbanisme: <span className="font-medium">{analyseUrbanistique.commune.typePLU}</span>
                        </p>
                      </div>

                      {/* Zone PLU */}
                      <div className="p-3 bg-white rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Zone PLU</p>
                        <p className="font-semibold">{analyseUrbanistique.zonePLU.code} - {analyseUrbanistique.zonePLU.designation}</p>
                        <p className="text-sm text-muted-foreground">
                          {analyseUrbanistique.zonePLU.description}
                        </p>
                        {analyseUrbanistique.zonePLU.hauteurMax && (
                          <p className="text-xs mt-1">
                            Hauteur max: <span className="font-medium">{analyseUrbanistique.zonePLU.hauteurMax}m</span>
                          </p>
                        )}
                      </div>

                      {/* Contact mairie */}
                      <div className="p-3 bg-white rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Service urbanisme</p>
                        {analyseUrbanistique.commune.contactUrbanisme && (
                          <>
                            <p className="text-sm">{analyseUrbanistique.commune.contactUrbanisme.email}</p>
                            <p className="text-sm">{analyseUrbanistique.commune.contactUrbanisme.telephone}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {analyseUrbanistique.commune.contactUrbanisme.horaires}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Secteurs protégés */}
                {analyseUrbanistique.secteursProteges.length > 0 && (
                  <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <span className="font-semibold">Attention : Secteur protégé détecté</span>
                      {analyseUrbanistique.secteursProteges.map((secteur, idx) => (
                        <div key={idx} className="mt-2 p-2 bg-white/50 rounded">
                          <p className="font-medium">{secteur.nom}</p>
                          <p className="text-sm">{secteur.description}</p>
                          {secteur.architecteBatimentsFrance && (
                            <Badge className="mt-1 bg-amber-200 text-amber-800">
                              Avis ABF obligatoire (+{secteur.delaiSupplementaire} jours)
                            </Badge>
                          )}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Autorisations requises détectées */}
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSignature className="w-5 h-5 text-primary" />
                      Autorisations détectées pour votre projet
                    </CardTitle>
                    <CardDescription>
                      Basé sur l'analyse de vos travaux, voici les démarches administratives requises
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analyseUrbanistique.autorisationsRequises.length === 0 ? (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <span className="font-medium">Aucune autorisation d'urbanisme requise</span>
                          <br />
                          Vos travaux ne nécessitent pas de déclaration préalable ni de permis.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      analyseUrbanistique.autorisationsRequises.map((auto, idx) => (
                        <Card key={idx} className={auto.obligatoire ? 'border-red-200' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">
                                    {auto.type === 'declaration_prealable' && 'Déclaration Préalable de Travaux'}
                                    {auto.type === 'permis_construire' && 'Permis de Construire'}
                                    {auto.type === 'permis_demolir' && 'Permis de Démolir'}
                                    {auto.type === 'autorisation_abf' && 'Autorisation ABF'}
                                  </h4>
                                  {auto.obligatoire && (
                                    <Badge variant="destructive">Obligatoire</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{auto.motif}</p>
                                <div className="grid md:grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Formulaire:</span>{' '}
                                    <span className="font-medium">Cerfa {auto.formulaire.cerfa}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Délai:</span>{' '}
                                    <span className="font-medium">
                                      {auto.delaiMajore || auto.delaiInstruction} jours
                                      {auto.delaiMajore && ' (majoré ABF)'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Dépôt:</span>{' '}
                                    <span className="font-medium">{auto.destination}</span>
                                  </div>
                                </div>

                                {/* Pièces principales */}
                                <details className="mt-3">
                                  <summary className="text-sm font-medium cursor-pointer text-primary">
                                    Voir les pièces à fournir ({auto.piecesPrincipales.length})
                                  </summary>
                                  <ul className="mt-2 ml-4 text-sm space-y-1">
                                    {auto.piecesPrincipales.map((piece, i) => (
                                      <li key={i} className="text-muted-foreground">• {piece}</li>
                                    ))}
                                  </ul>
                                </details>
                              </div>

                              <div className="flex flex-col gap-2 ml-4">
                                <Button
                                  size="sm"
                                  onClick={() => setShowPrefilledDoc(auto.type)}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Pré-remplir
                                </Button>
                                {auto.formulaire.url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(auto.formulaire.url, '_blank')}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    Cerfa
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Recommandations */}
                {analyseUrbanistique.recommandations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Recommandations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analyseUrbanistique.recommandations.map((reco, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <Badge variant={reco.priorite === 'haute' ? 'destructive' : reco.priorite === 'moyenne' ? 'default' : 'secondary'} className="mt-0.5">
                              {reco.priorite}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{reco.titre}</p>
                              <p className="text-xs text-muted-foreground">{reco.description}</p>
                              <p className="text-xs text-primary mt-1">→ {reco.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Risques identifiés */}
                {analyseUrbanistique.risques.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Risques identifiés
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analyseUrbanistique.risques.map((risque, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={risque.probabilite === 'haute' ? 'destructive' : risque.probabilite === 'moyenne' ? 'default' : 'secondary'}>
                                {risque.probabilite}
                              </Badge>
                              <span className="font-medium text-sm capitalize">{risque.type}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{risque.description}</p>
                            <p className="text-xs text-green-700 mt-1">Prévention: {risque.prevention}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Autres formalités obligatoires */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Déclarations complémentaires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4" disabled />
                    <div>
                      <p className="font-medium text-sm">DICT - Déclaration réseaux</p>
                      <p className="text-xs text-muted-foreground">Obligatoire 7 jours avant le démarrage</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowContractExample('dict')}>
                      <Eye className="w-3 h-3 mr-1" />
                      Voir
                    </Button>
                    <Button size="sm" onClick={() => window.open('https://www.reseaux-et-canalisations.gouv.fr', '_blank')}>
                      Effectuer
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4" disabled />
                    <div>
                      <p className="font-medium text-sm">DOC - Ouverture de chantier</p>
                      <p className="text-xs text-muted-foreground">À déposer en mairie après obtention de l'autorisation</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowContractExample('doc')}>
                    <Eye className="w-3 h-3 mr-1" />
                    Modèle
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4" disabled />
                    <div>
                      <p className="font-medium text-sm">Information voisinage</p>
                      <p className="text-xs text-muted-foreground">Courrier de courtoisie recommandé</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowContractExample('courrier_voisinage')}>
                    <Eye className="w-3 h-3 mr-1" />
                    Modèle
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Document pré-rempli */}
            {showPrefilledDoc && analyseUrbanistique && project && (
              <Card className="border-2 border-green-200 bg-green-50/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      Document pré-rempli avec vos données
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowPrefilledDoc(null)}>
                      Fermer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-6 border shadow-sm max-h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                    {UrbanismeService.generatePrefilledDocument(
                      showPrefilledDoc as any,
                      project,
                      analyseUrbanistique
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="w-3 h-3 mr-1" />
                      Télécharger
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const text = UrbanismeService.generatePrefilledDocument(
                        showPrefilledDoc as any,
                        project,
                        analyseUrbanistique
                      );
                      navigator.clipboard.writeText(text);
                      toast({ title: 'Copié !', description: 'Document copié dans le presse-papier' });
                    }}>
                      Copier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Exemples de documents */}
            {showContractExample && ['dict', 'doc', 'panneau', 'courrier_voisinage'].includes(showContractExample) && (
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Modèle de document
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowContractExample(null)}>
                      Fermer
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-6 border shadow-sm max-h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
                    {showContractExample === 'dict' && `======================================================================
DÉCLARATION D'INTENTION DE COMMENCEMENT DE TRAVAUX (DICT)
Cerfa n°14434*03
======================================================================

1. DÉCLARANT
   Raison sociale: [Nom de l'entreprise]
   SIRET: [Numéro SIRET]

2. MAÎTRE D'OUVRAGE
   Nom: ${project?.ownerProfile?.identity?.type === 'B2C' ? `${(project.ownerProfile.identity as any).firstName || ''} ${(project.ownerProfile.identity as any).lastName || ''}` : '[Votre nom]'}
   Adresse: ${project?.ownerProfile?.contact?.address?.street || '[Votre adresse]'}
   Email: ${project?.ownerProfile?.contact?.email || '[Email]'}
   Téléphone: ${project?.ownerProfile?.contact?.phone || '[Téléphone]'}

3. LOCALISATION DES TRAVAUX
   Adresse: ${project?.property?.identification?.address?.streetName || project?.property?.address?.street || '[Adresse du chantier]'}
   ${project?.property?.identification?.address?.postalCode || project?.property?.address?.postalCode || ''} ${project?.property?.identification?.address?.city || project?.property?.address?.city || ''}

4. NATURE DES TRAVAUX
   ${project?.workProject?.general?.description || '[Description des travaux]'}

5. DATE DE COMMENCEMENT PRÉVUE
   [Date]

----------------------------------------------------------------------
À effectuer sur: www.reseaux-et-canalisations.gouv.fr`}
                    {showContractExample === 'doc' && `======================================================================
DÉCLARATION D'OUVERTURE DE CHANTIER (DOC)
Cerfa n°13407*05
======================================================================

1. IDENTITÉ DU DÉCLARANT
   ${project?.ownerProfile?.identity?.type === 'B2C' ? `Nom: ${(project.ownerProfile.identity as any).firstName || ''} ${(project.ownerProfile.identity as any).lastName || ''}` : '[Votre nom]'}
   Adresse: ${project?.ownerProfile?.contact?.address?.street || '[Adresse]'}
   ${project?.ownerProfile?.contact?.address?.postalCode || ''} ${project?.ownerProfile?.contact?.address?.city || ''}

2. TERRAIN
   Adresse: ${project?.property?.identification?.address?.streetName || project?.property?.address?.street || '[Adresse du chantier]'}
   ${project?.property?.identification?.address?.postalCode || project?.property?.address?.postalCode || ''} ${project?.property?.identification?.address?.city || project?.property?.address?.city || ''}

3. AUTORISATION D'URBANISME
   Type: [ ] Déclaration préalable [ ] Permis de construire
   Numéro: _______________

----------------------------------------------------------------------
À déposer en mairie du lieu des travaux.`}
                    {showContractExample === 'panneau' && `============================================================
PANNEAU D'AFFICHAGE RÉGLEMENTAIRE
============================================================

Bénéficiaire: ${project?.ownerProfile?.identity?.type === 'B2C' ? `${(project.ownerProfile.identity as any).firstName || ''} ${(project.ownerProfile.identity as any).lastName || ''}` : '[Votre nom]'}

Nature des travaux:
${project?.workProject?.general?.description || '[Description des travaux]'}

Surface de plancher: ${project?.property?.surface || '___'} m²

--------------------------------------------------------------
Dimensions minimales: 80cm x 120cm
À installer sur le terrain, visible de la voie publique`}
                    {showContractExample === 'courrier_voisinage' && `${project?.ownerProfile?.identity?.type === 'B2C' ? `${(project.ownerProfile.identity as any).firstName || ''} ${(project.ownerProfile.identity as any).lastName || ''}` : '[Votre nom]'}
${project?.ownerProfile?.contact?.address?.street || '[Votre adresse]'}
${project?.ownerProfile?.contact?.address?.postalCode || ''} ${project?.ownerProfile?.contact?.address?.city || ''}

                            ${project?.property?.identification?.address?.city || project?.property?.address?.city || '[Ville]'}, le ${new Date().toLocaleDateString('fr-FR')}

Madame, Monsieur,

Je vous informe que des travaux vont être réalisés à l'adresse:
${project?.property?.identification?.address?.streetName || project?.property?.address?.street || '[Adresse du chantier]'}

Nature: ${project?.workProject?.general?.description || '[Description]'}

Horaires: 7h30-18h00 (lun-ven), 8h00-12h00 (sam si nécessaire)

Contact: ${project?.ownerProfile?.contact?.email || '[Email]'}
         ${project?.ownerProfile?.contact?.phone || '[Téléphone]'}

Cordialement`}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Message si pas encore analysé */}
            {!analyseUrbanistique && project && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="w-16 h-16 text-primary/30 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Analyse intelligente disponible</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Cliquez sur "Analyser mon projet" pour identifier automatiquement les autorisations
                    d'urbanisme requises selon votre localisation et votre type de travaux.
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Détection zone PLU</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Secteurs protégés</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>Documents pré-remplis</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      </div>

      {/* Visualiseur de documents DCE */}
      {consultationState.dce && (
        <DCEDocumentViewer
          open={showDocViewer}
          onOpenChange={setShowDocViewer}
          dce={consultationState.dce}
          documentType={docViewerType}
          userType={userType as 'B2C' | 'B2B' | 'B2G'}
        />
      )}
    </AppLayout>
  );
}

export default Phase1Consultation;
