/**
 * DCETab - Composant pour l'onglet DCE (Dossier de Consultation des Entreprises)
 * Extrait de Phase1Consultation.tsx pour meilleure maintenabilité
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, RefreshCw, Download, Eye } from 'lucide-react';
import { DCEDocumentViewer } from '../DCEDocumentViewer';
import { DCEService } from '@/services/phase1/dce.service';
import { useToast } from '@/hooks/use-toast';
import type { DCEDocument } from '@/types/phase1/dce.types';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { UserType } from '@/types/user.types';

interface DCETabProps {
  projectId: string;
  project: Phase0Project | null;
  userType: UserType;
  dce: DCEDocument | null;
  onDCEGenerated: (dce: DCEDocument) => void;
}

export function DCETab({
  projectId,
  project,
  userType,
  dce,
  onDCEGenerated
}: DCETabProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<'rc' | 'ae' | 'dpgf' | 'mt' | 'all'>('all');

  const handleGenerateDCE = useCallback(async () => {
    if (!project) {
      toast({
        title: 'Erreur',
        description: 'Projet non chargé',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const wizardMode = userType === 'B2C' ? 'b2c_simple' :
                         userType === 'B2G' ? 'b2g_public' :
                         'b2b_professional';

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
        onDCEGenerated(result.dce);
        toast({
          title: 'DCE généré',
          description: 'Le dossier de consultation a été créé avec succès',
        });
      } else if (result.errors && result.errors.length > 0) {
        toast({
          title: 'Erreur de génération',
          description: result.errors[0],
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erreur génération DCE:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le DCE',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [project, userType, onDCEGenerated, toast]);

  const handleRegenerateDocument = useCallback(async (docType: 'rc' | 'ae' | 'dpgf' | 'mt') => {
    if (!project || !dce) return;

    setIsGenerating(true);
    try {
      const wizardMode = userType === 'B2C' ? 'b2c_simple' :
                         userType === 'B2G' ? 'b2g_public' :
                         'b2b_professional';

      const result = await DCEService.generateDCE({
        project: { ...project, wizardMode },
        config: {
          includeRC: docType === 'rc',
          includeAE: docType === 'ae',
          includeDPGF: docType === 'dpgf',
          includeCadreMT: docType === 'mt',
        },
      });

      if (result.success && result.dce) {
        onDCEGenerated(result.dce);
        toast({
          title: 'Document régénéré',
          description: `Le document ${docType.toUpperCase()} a été mis à jour`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de régénérer le document',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [project, dce, userType, onDCEGenerated, toast]);

  // Labels adaptés au profil utilisateur
  const getLabels = () => {
    switch (userType) {
      case 'B2C':
        return {
          title: 'Dossier de consultation',
          description: 'Préparez votre dossier pour consulter les artisans',
          generateBtn: 'Créer mon dossier',
          viewBtn: 'Voir mon dossier',
        };
      case 'B2B':
        return {
          title: 'Dossier de Consultation des Entreprises',
          description: 'Consultez le DCE pour préparer votre offre',
          generateBtn: 'Accéder au DCE',
          viewBtn: 'Consulter le DCE',
        };
      case 'B2G':
        return {
          title: 'DCE - Marché Public',
          description: 'Dossier de Consultation des Entreprises conforme MAPA/AO',
          generateBtn: 'Générer le DCE',
          viewBtn: 'Consulter le DCE',
        };
      default:
        return {
          title: 'DCE',
          description: 'Dossier de Consultation',
          generateBtn: 'Générer',
          viewBtn: 'Voir',
        };
    }
  };

  const labels = getLabels();

  if (!dce) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              {userType === 'B2B'
                ? 'Le DCE n\'a pas encore été publié par le maître d\'ouvrage.'
                : 'Générez votre dossier de consultation pour commencer à rechercher des entreprises.'}
            </AlertDescription>
          </Alert>

          {userType !== 'B2B' && (
            <Button
              onClick={handleGenerateDCE}
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
                  <FileText className="w-4 h-4 mr-2" />
                  {labels.generateBtn}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Résumé DCE */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{labels.title}</CardTitle>
              <CardDescription>
                Référence: {dce.metadata?.reference || 'N/A'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewerOpen(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {labels.viewBtn}
              </Button>
              {userType !== 'B2B' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDCE}
                  disabled={isGenerating}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  Régénérer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* RC */}
            <DocumentCard
              title="Règlement de Consultation"
              shortName="RC"
              status={dce.reglementConsultation ? 'ready' : 'pending'}
              onClick={() => {
                setActiveDocument('rc');
                setViewerOpen(true);
              }}
              onRegenerate={userType !== 'B2B' ? () => handleRegenerateDocument('rc') : undefined}
            />

            {/* AE */}
            <DocumentCard
              title="Acte d'Engagement"
              shortName="AE"
              status={dce.acteEngagement ? 'ready' : 'pending'}
              onClick={() => {
                setActiveDocument('ae');
                setViewerOpen(true);
              }}
              onRegenerate={userType !== 'B2B' ? () => handleRegenerateDocument('ae') : undefined}
            />

            {/* DPGF */}
            <DocumentCard
              title="DPGF"
              shortName="DPGF"
              status={dce.decompositionPrix ? 'ready' : 'pending'}
              onClick={() => {
                setActiveDocument('dpgf');
                setViewerOpen(true);
              }}
              onRegenerate={userType !== 'B2B' ? () => handleRegenerateDocument('dpgf') : undefined}
            />

            {/* MT */}
            <DocumentCard
              title="Cadre Mémoire Technique"
              shortName="MT"
              status={dce.cadreMemoireTechnique ? 'ready' : 'pending'}
              onClick={() => {
                setActiveDocument('mt');
                setViewerOpen(true);
              }}
              onRegenerate={userType !== 'B2B' ? () => handleRegenerateDocument('mt') : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Viewer Modal */}
      {viewerOpen && dce && (
        <DCEDocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          dce={dce}
          documentType={activeDocument}
          userType={userType}
        />
      )}
    </div>
  );
}

// Sous-composant pour les cartes de documents
interface DocumentCardProps {
  title: string;
  shortName: string;
  status: 'ready' | 'pending' | 'error';
  onClick: () => void;
  onRegenerate?: () => void;
}

function DocumentCard({ title, shortName, status, onClick, onRegenerate }: DocumentCardProps) {
  return (
    <div
      className={`
        p-4 rounded-lg border cursor-pointer transition-colors
        ${status === 'ready' ? 'border-green-200 bg-green-50 hover:bg-green-100' :
          status === 'error' ? 'border-red-200 bg-red-50' :
          'border-gray-200 bg-gray-50'}
      `}
      onClick={onClick}
    >
      <div className="text-center">
        <div className={`
          text-2xl font-bold mb-1
          ${status === 'ready' ? 'text-green-700' :
            status === 'error' ? 'text-red-700' :
            'text-gray-500'}
        `}>
          {shortName}
        </div>
        <div className="text-xs text-muted-foreground truncate">{title}</div>
        <div className="mt-2 flex justify-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Eye className="w-3 h-3" />
          </Button>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DCETab;
