/**
 * ContratTab - Composant pour l'onglet Contractualisation
 * Extrait de Phase1Consultation.tsx pour meilleure maintenabilité
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  FileSignature,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Euro,
  Calendar,
  Shield
} from 'lucide-react';
import { ContratService } from '@/services/phase1/contrat.service';
import { phase1PDFService } from '@/services/phase1/pdf-export.service';
import { signatureService } from '@/services/phase1/signature.service';
import { useToast } from '@/hooks/use-toast';
import type { Contrat, StatutContrat } from '@/types/phase1/contrat.types';
import type { Offre } from '@/types/phase1/offre.types';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { UserType } from '@/types/user.types';

interface ContratTabProps {
  projectId: string;
  project: Phase0Project | null;
  selectedOffre: Offre | null;
  contrat: Contrat | null;
  userType: UserType;
  onContratGenerated: (contrat: Contrat) => void;
  onContratUpdated: (contrat: Contrat) => void;
}

export function ContratTab({
  projectId,
  project,
  selectedOffre,
  contrat,
  userType,
  onContratGenerated,
  onContratUpdated
}: ContratTabProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Générer le contrat
  const handleGenerateContrat = useCallback(async () => {
    if (!project || !selectedOffre) {
      toast({
        title: 'Données manquantes',
        description: 'Sélectionnez une offre avant de générer le contrat',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const wizardMode = userType === 'B2C' ? 'b2c_simple' :
                         userType === 'B2G' ? 'b2g_public' :
                         'b2b_professional';

      const newContrat = await ContratService.generateContrat({
        project: { ...project, wizardMode },
        offre: selectedOffre,
        entreprise: selectedOffre.entreprise,
      });

      // Vérification juridique automatique
      const verification = ContratService.verifyContrat(newContrat);

      if (!verification.conformite) {
        toast({
          title: 'Attention',
          description: `Le contrat nécessite des ajustements: ${verification.alertes[0]?.message}`,
          variant: 'destructive',
        });
      }

      await ContratService.saveContrat(newContrat);
      onContratGenerated(newContrat);

      toast({
        title: 'Contrat généré',
        description: 'Le contrat a été créé avec succès',
      });
    } catch (error) {
      console.error('Erreur génération contrat:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le contrat',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [project, selectedOffre, userType, onContratGenerated, toast]);

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    if (!contrat) return;

    setIsExporting(true);
    try {
      const blob = await phase1PDFService.exportContrat(contrat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrat-${contrat.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: 'Le contrat a été téléchargé',
      });
    } catch (error) {
      toast({
        title: 'Erreur export',
        description: 'Impossible de générer le PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [contrat, toast]);

  // Demander signature
  const handleRequestSignature = useCallback(async (signataireType: 'maitre_ouvrage' | 'entreprise') => {
    if (!contrat) return;

    try {
      const signataire = signataireType === 'maitre_ouvrage'
        ? {
            nom: contrat.parties.maitreOuvrage.nom || '',
            email: contrat.parties.maitreOuvrage.email || '',
          }
        : {
            nom: contrat.parties.entreprise.raisonSociale || '',
            email: contrat.parties.entreprise.contact?.email || '',
          };

      const result = await signatureService.requestSignature({
        contratId: contrat.id,
        signataireType,
        signataire,
        documentUrl: '', // À implémenter avec URL du document
      });

      if (result.success) {
        toast({
          title: 'Signature demandée',
          description: `Une demande de signature a été envoyée`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer la demande de signature',
        variant: 'destructive',
      });
    }
  }, [contrat, toast]);

  // Labels adaptés au profil
  const getLabels = () => {
    switch (userType) {
      case 'B2C':
        return {
          title: 'Contrat de travaux',
          description: 'Finalisez votre accord avec l\'artisan sélectionné',
          generateBtn: 'Générer le contrat',
          noOffre: 'Sélectionnez un devis pour générer le contrat',
        };
      case 'B2B':
        return {
          title: 'Contrat',
          description: 'Votre contrat de sous-traitance',
          generateBtn: 'Voir le contrat',
          noOffre: 'Contrat non disponible',
        };
      case 'B2G':
        return {
          title: 'Marché de travaux',
          description: 'Notification et signature du marché',
          generateBtn: 'Générer le marché',
          noOffre: 'Sélectionnez l\'offre retenue pour établir le marché',
        };
      default:
        return {
          title: 'Contrat',
          description: 'Gestion du contrat',
          generateBtn: 'Générer',
          noOffre: 'Aucune offre sélectionnée',
        };
    }
  };

  const labels = getLabels();

  // Pas d'offre sélectionnée
  if (!selectedOffre) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{labels.noOffre}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Pas encore de contrat
  if (!contrat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Offre sélectionnée</h4>
            <p className="text-sm">
              {selectedOffre.entreprise?.identification?.raisonSociale}
            </p>
            <p className="text-lg font-bold mt-1">
              {selectedOffre.contenu?.propositionFinanciere?.montantTotalTTC?.toLocaleString('fr-FR')} € TTC
            </p>
          </div>

          <Button
            onClick={handleGenerateContrat}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4 mr-2" />
                {labels.generateBtn}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Affichage contrat existant
  return (
    <div className="space-y-6">
      {/* Statut du contrat */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>Réf: {contrat.id.slice(0, 8)}</CardDescription>
            </div>
            <StatutBadge statut={contrat.statut} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progression signature */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression</span>
              <span>{getProgressPercent(contrat.statut)}%</span>
            </div>
            <Progress value={getProgressPercent(contrat.statut)} />
          </div>

          {/* Étapes de signature */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <SignatureStep
              label="Brouillon"
              icon={FileText}
              completed={contrat.statut !== 'brouillon'}
              current={contrat.statut === 'brouillon'}
            />
            <SignatureStep
              label="Signature Entreprise"
              icon={FileSignature}
              completed={['signe_mo', 'notifie', 'en_cours', 'termine'].includes(contrat.statut)}
              current={contrat.statut === 'signe_entreprise' || contrat.statut === 'a_signer'}
            />
            <SignatureStep
              label="Signature MOA"
              icon={CheckCircle}
              completed={['notifie', 'en_cours', 'termine'].includes(contrat.statut)}
              current={contrat.statut === 'signe_mo'}
            />
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Télécharger PDF
          </Button>
          {contrat.statut === 'brouillon' && (
            <Button onClick={() => handleRequestSignature('entreprise')}>
              <FileSignature className="w-4 h-4 mr-2" />
              Envoyer pour signature
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Résumé contrat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Euro className="w-4 h-4" />
              Montant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {contrat.conditionsFinancieres?.prixTotal?.ttc?.toLocaleString('fr-FR')} €
            </p>
            <p className="text-sm text-muted-foreground">TTC</p>
          </CardContent>
        </Card>

        {/* Délais */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Délai d'exécution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {contrat.delais?.execution?.duree || '-'} jours
            </p>
            <p className="text-sm text-muted-foreground">calendaires</p>
          </CardContent>
        </Card>

        {/* Garanties */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Garanties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">10 ans</p>
            <p className="text-sm text-muted-foreground">garantie décennale</p>
          </CardContent>
        </Card>
      </div>

      {/* Parties */}
      <Card>
        <CardHeader>
          <CardTitle>Parties au contrat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Maître d'ouvrage */}
            <div>
              <h4 className="font-medium mb-2">Maître d'ouvrage</h4>
              <p>{contrat.parties?.maitreOuvrage?.nom}</p>
              <p className="text-sm text-muted-foreground">
                {contrat.parties?.maitreOuvrage?.adresse}
              </p>
            </div>

            {/* Entreprise */}
            <div>
              <h4 className="font-medium mb-2">Entreprise</h4>
              <p>{contrat.parties?.entreprise?.raisonSociale}</p>
              <p className="text-sm text-muted-foreground">
                SIRET: {contrat.parties?.entreprise?.siret}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Composant badge statut
function StatutBadge({ statut }: { statut: StatutContrat }) {
  const config: Record<StatutContrat, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    brouillon: { label: 'Brouillon', variant: 'secondary' },
    en_negociation: { label: 'En négociation', variant: 'outline' },
    a_signer: { label: 'À signer', variant: 'default' },
    signe_entreprise: { label: 'Signé entreprise', variant: 'default' },
    signe_mo: { label: 'Signé MOA', variant: 'default' },
    notifie: { label: 'Notifié', variant: 'default' },
    en_cours: { label: 'En cours', variant: 'default' },
    termine: { label: 'Terminé', variant: 'secondary' },
    resilie: { label: 'Résilié', variant: 'destructive' },
    archive: { label: 'Archivé', variant: 'secondary' },
  };

  const { label, variant } = config[statut] || { label: statut, variant: 'secondary' };

  return <Badge variant={variant}>{label}</Badge>;
}

// Composant étape signature
function SignatureStep({
  label,
  icon: Icon,
  completed,
  current
}: {
  label: string;
  icon: React.ElementType;
  completed: boolean;
  current: boolean;
}) {
  return (
    <div className={`
      text-center p-3 rounded-lg border
      ${completed ? 'border-green-200 bg-green-50' :
        current ? 'border-primary bg-primary/5' :
        'border-gray-200 bg-gray-50'}
    `}>
      <Icon className={`
        w-6 h-6 mx-auto mb-2
        ${completed ? 'text-green-600' :
          current ? 'text-primary' :
          'text-gray-400'}
      `} />
      <p className={`text-xs ${completed || current ? 'font-medium' : 'text-muted-foreground'}`}>
        {label}
      </p>
    </div>
  );
}

// Helper: progression en pourcentage
function getProgressPercent(statut: StatutContrat): number {
  const progressMap: Record<StatutContrat, number> = {
    brouillon: 20,
    en_negociation: 30,
    a_signer: 40,
    signe_entreprise: 60,
    signe_mo: 80,
    notifie: 90,
    en_cours: 95,
    termine: 100,
    resilie: 0,
    archive: 100,
  };
  return progressMap[statut] || 0;
}

export default ContratTab;
