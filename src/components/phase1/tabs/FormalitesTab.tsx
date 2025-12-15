/**
 * FormalitesTab - Composant pour l'onglet Préparation Administrative
 * Extrait de Phase1Consultation.tsx pour meilleure maintenabilité
 */

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Loader2,
  FileCheck,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  Building,
  Shield,
  Car,
  FileText,
  Bell
} from 'lucide-react';
import { FormalitesService } from '@/services/phase1/formalites.service';
import { UrbanismeService } from '@/services/phase1/urbanisme.service';
import { useToast } from '@/hooks/use-toast';
import type { DossierFormalites, ChecklistItem, AlerteFormalite } from '@/types/phase1/formalites.types';
import type { AnalyseUrbanistique } from '@/types/phase1/urbanisme.types';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { Contrat } from '@/types/phase1/contrat.types';
import type { UserType } from '@/types/user.types';

interface FormalitesTabProps {
  projectId: string;
  project: Phase0Project | null;
  contrat: Contrat | null;
  userType: UserType;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'urbanisme', label: 'Urbanisme', icon: Building, description: 'Autorisations et déclarations urbanistiques' },
  { id: 'declarations', label: 'Déclarations', icon: FileText, description: 'DICT, DOC, déclarations préalables' },
  { id: 'securite', label: 'Sécurité', icon: Shield, description: 'Coordination SPS, PGC, PPSPS' },
  { id: 'voirie', label: 'Voirie', icon: Car, description: 'Autorisations de stationnement et circulation' },
  { id: 'autres', label: 'Autres', icon: FileCheck, description: 'Assurances, voisinage, affichages' },
];

export function FormalitesTab({
  projectId,
  project,
  contrat,
  userType
}: FormalitesTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dossier, setDossier] = useState<DossierFormalites | null>(null);
  const [analyseUrbanisme, setAnalyseUrbanisme] = useState<AnalyseUrbanistique | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['urbanisme']);

  // Charger le dossier existant
  useEffect(() => {
    const loadDossier = async () => {
      try {
        const existingDossier = await FormalitesService.getDossierByProjectId(projectId);
        if (existingDossier) {
          setDossier(existingDossier);
        }
      } catch (error) {
        console.error('Erreur chargement dossier:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDossier();
  }, [projectId]);

  // Générer le dossier de formalités
  const handleGenerateDossier = useCallback(async () => {
    if (!project) {
      toast({
        title: 'Erreur',
        description: 'Données projet manquantes',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Analyse urbanistique
      const analyse = await UrbanismeService.analyzeProject(project);
      setAnalyseUrbanisme(analyse);

      // Génération dossier formalités
      const newDossier = await FormalitesService.generateDossierFormalites({
        project,
        contrat: contrat || undefined,
        analyseUrbanisme: analyse,
      });

      await FormalitesService.saveDossier(newDossier);
      setDossier(newDossier);

      toast({
        title: 'Dossier généré',
        description: `${newDossier.alertes?.length || 0} point(s) d'attention identifié(s)`,
      });
    } catch (error) {
      console.error('Erreur génération dossier:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le dossier',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [project, contrat, toast]);

  // Mettre à jour un item de checklist
  const handleChecklistUpdate = useCallback(async (itemId: string, completed: boolean) => {
    if (!dossier) return;

    try {
      await FormalitesService.updateChecklistItem(projectId, itemId, {
        statut: completed ? 'complete' : 'non_commence',
        dateCompletion: completed ? new Date().toISOString() : undefined,
      });

      // Mettre à jour localement
      setDossier(prev => {
        if (!prev) return null;
        // Mise à jour simplifiée - en production, recalculer la progression
        return {
          ...prev,
          progression: Math.min(100, (prev.progression || 0) + (completed ? 5 : -5)),
        };
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour',
        variant: 'destructive',
      });
    }
  }, [dossier, projectId, toast]);

  // Générer un document (DICT, DOC, etc.)
  const handleGenerateDocument = useCallback(async (docType: string) => {
    if (!project) return;

    try {
      let content: string = '';

      switch (docType) {
        case 'dict':
          content = FormalitesService.generateFormulaireDICT({
            project,
            entreprise: contrat?.parties?.entreprise,
            dateDebutPrevue: contrat?.delais?.execution?.dateDebut,
          });
          break;
        case 'doc':
          content = FormalitesService.generateFormulaireDOC(
            project,
            contrat?.delais?.execution?.dateDebut || new Date().toISOString()
          );
          break;
        case 'voisinage':
          if (contrat) {
            content = FormalitesService.generateCourrierVoisinage(project, contrat);
          }
          break;
        case 'panneau':
          content = FormalitesService.generatePanneauChantier(
            project,
            analyseUrbanisme?.autorisationsRequises?.[0]?.type || 'dp',
            'NUMERO-A-COMPLETER',
            new Date().toISOString()
          );
          break;
      }

      if (content) {
        // Télécharger comme fichier texte
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docType}-${projectId.slice(0, 8)}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Document généré',
          description: 'Le document a été téléchargé',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le document',
        variant: 'destructive',
      });
    }
  }, [project, contrat, analyseUrbanisme, projectId, toast]);

  // Toggle catégorie
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Labels adaptés au profil
  const getLabels = () => {
    switch (userType) {
      case 'B2C':
        return {
          title: 'Préparation du chantier',
          description: 'Vérifiez les formalités avant le démarrage des travaux',
        };
      case 'B2B':
        return {
          title: 'Formalités chantier',
          description: 'Documents et autorisations à préparer',
        };
      case 'B2G':
        return {
          title: 'Préparation administrative',
          description: 'Formalités réglementaires et administratives',
        };
      default:
        return {
          title: 'Formalités',
          description: 'Préparation administrative',
        };
    }
  };

  const labels = getLabels();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Pas encore de dossier
  if (!dossier) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Générez le dossier de formalités pour identifier les démarches à effectuer.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleGenerateDossier}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4 mr-2" />
                Analyser les formalités requises
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progression globale */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>{labels.description}</CardDescription>
            </div>
            <StatutBadge statut={dossier.statut} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression</span>
              <span>{dossier.progression || 0}%</span>
            </div>
            <Progress value={dossier.progression || 0} />
          </div>

          {dossier.progression === 100 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertTitle className="text-green-800">Prêt pour le chantier</AlertTitle>
              <AlertDescription className="text-green-700">
                Toutes les formalités sont complètes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Alertes */}
      {dossier.alertes && dossier.alertes.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Bell className="w-5 h-5" />
              Points d'attention ({dossier.alertes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dossier.alertes.map((alerte, index) => (
                <AlerteItem key={index} alerte={alerte} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catégories de formalités */}
      {CATEGORIES.map(category => (
        <Collapsible
          key={category.id}
          open={expandedCategories.includes(category.id)}
          onOpenChange={() => toggleCategory(category.id)}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <category.icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{category.label}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${
                    expandedCategories.includes(category.id) ? 'rotate-180' : ''
                  }`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <CategoryContent
                  category={category.id}
                  dossier={dossier}
                  onChecklistUpdate={handleChecklistUpdate}
                  onGenerateDocument={handleGenerateDocument}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}

// Composant contenu catégorie
function CategoryContent({
  category,
  dossier,
  onChecklistUpdate,
  onGenerateDocument
}: {
  category: string;
  dossier: DossierFormalites;
  onChecklistUpdate: (itemId: string, completed: boolean) => void;
  onGenerateDocument: (docType: string) => void;
}) {
  // Récupérer les items de checklist pour cette catégorie
  const categoryData = dossier[category as keyof DossierFormalites];

  // Boutons de génération spécifiques à la catégorie
  const getActionButtons = () => {
    switch (category) {
      case 'declarations':
        return (
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => onGenerateDocument('dict')}>
              <Download className="w-4 h-4 mr-2" />
              Générer DICT
            </Button>
            <Button variant="outline" size="sm" onClick={() => onGenerateDocument('doc')}>
              <Download className="w-4 h-4 mr-2" />
              Générer DOC
            </Button>
          </div>
        );
      case 'autres':
        return (
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => onGenerateDocument('voisinage')}>
              <Download className="w-4 h-4 mr-2" />
              Courrier voisinage
            </Button>
            <Button variant="outline" size="sm" onClick={() => onGenerateDocument('panneau')}>
              <Download className="w-4 h-4 mr-2" />
              Panneau chantier
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  // Liste d'items standard par catégorie
  const getDefaultItems = (): { id: string; label: string; obligatoire: boolean }[] => {
    switch (category) {
      case 'urbanisme':
        return [
          { id: 'autorisation', label: 'Autorisation d\'urbanisme obtenue', obligatoire: true },
          { id: 'panneau', label: 'Panneau de chantier installé', obligatoire: true },
          { id: 'affichage', label: 'Affichage conforme (2 mois)', obligatoire: true },
        ];
      case 'declarations':
        return [
          { id: 'dict', label: 'DICT déposée', obligatoire: true },
          { id: 'doc', label: 'DOC déposée', obligatoire: false },
          { id: 'dpt', label: 'Déclaration préalable travaux', obligatoire: false },
        ];
      case 'securite':
        return [
          { id: 'sps', label: 'Coordonnateur SPS désigné', obligatoire: false },
          { id: 'pgc', label: 'PGC établi', obligatoire: false },
          { id: 'ppsps', label: 'PPSPS reçus', obligatoire: false },
          { id: 'registre', label: 'Registre journal chantier', obligatoire: false },
        ];
      case 'voirie':
        return [
          { id: 'stationnement', label: 'Autorisation stationnement', obligatoire: false },
          { id: 'circulation', label: 'Arrêté de circulation', obligatoire: false },
        ];
      case 'autres':
        return [
          { id: 'assurance_rc', label: 'Attestations RC obtenues', obligatoire: true },
          { id: 'assurance_do', label: 'Dommage-ouvrage souscrit', obligatoire: false },
          { id: 'voisinage', label: 'Voisinage informé', obligatoire: false },
          { id: 'horaires', label: 'Horaires chantier affichés', obligatoire: true },
          { id: 'contacts', label: 'Coordonnées contact affichées', obligatoire: true },
          { id: 'urgences', label: 'Numéros urgence affichés', obligatoire: true },
        ];
      default:
        return [];
    }
  };

  const items = getDefaultItems();

  return (
    <div className="space-y-4">
      {getActionButtons()}

      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50"
          >
            <Checkbox
              id={`${category}-${item.id}`}
              onCheckedChange={(checked) => onChecklistUpdate(`${category}-${item.id}`, !!checked)}
            />
            <label
              htmlFor={`${category}-${item.id}`}
              className="flex-1 text-sm cursor-pointer"
            >
              {item.label}
            </label>
            {item.obligatoire && (
              <Badge variant="secondary" className="text-xs">
                Obligatoire
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Composant badge statut
function StatutBadge({ statut }: { statut: string }) {
  const config: Record<string, { label: string; className: string }> = {
    a_completer: { label: 'À compléter', className: 'bg-orange-100 text-orange-800' },
    en_cours: { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
    en_attente_validation: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
    valide: { label: 'Validé', className: 'bg-green-100 text-green-800' },
    pret_demarrage: { label: 'Prêt', className: 'bg-green-100 text-green-800' },
  };

  const { label, className } = config[statut] || { label: statut, className: '' };

  return <Badge className={className}>{label}</Badge>;
}

// Composant item alerte
function AlerteItem({ alerte }: { alerte: AlerteFormalite }) {
  const getIcon = () => {
    switch (alerte.severite) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-lg
      ${alerte.severite === 'error' ? 'bg-red-50' :
        alerte.severite === 'warning' ? 'bg-orange-50' :
        'bg-blue-50'}
    `}>
      {getIcon()}
      <div>
        <p className="text-sm font-medium">{alerte.message}</p>
        {alerte.dateEcheance && (
          <p className="text-xs text-muted-foreground mt-1">
            Échéance: {new Date(alerte.dateEcheance).toLocaleDateString('fr-FR')}
          </p>
        )}
      </div>
    </div>
  );
}

export default FormalitesTab;
